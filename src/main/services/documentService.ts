import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { shell } from 'electron';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { ActivityLogService } from '@main/services/activityLogService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import {
  FileStorageService,
  type DiscoveredVersionFile,
  type ManagedFileInfo
} from '@main/services/fileStorageService';
import { TemplateService } from '@main/services/templateService';
import type { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { nowIso } from '@main/utils/date';
import {
  getAlphaUppercaseVersionLabel,
  isDocumentVersionFileRole,
  isDocumentVersionScheme,
  isVersionBumpType,
  type DocumentVersionFileRole,
  type DocumentVersionScheme,
  type VersionBumpType
} from '@shared/documentModel';
import type {
  AddDocumentVersionFilesInput,
  ApplyVersionFilesystemReconciliationInput,
  ChangeDocumentVersionFileRoleInput,
  CreateDocumentInput,
  DeleteDocumentInput,
  DeleteDocumentVersionInput,
  CreateVersionInput,
  DeleteDocumentVersionFileInput,
  DocumentDetail,
  DocumentHealthFlag,
  DocumentListItem,
  DocumentStatus,
  DocumentVersion,
  DocumentVersionFile,
  FilePreviewResult,
  RenameDocumentVersionFileInput,
  UpdateDocumentInput,
  UpdateDocumentVersionInput,
  UpdateLatestVersionInput,
  VersionComparisonResult,
  VersionFilesystemChange,
  VersionFilesystemState,
  VersionFileDelta,
  VersionFileImportPlan
} from '@shared/types';

interface DocumentListRow {
  Id: number;
  DisplayDocumentID: string;
  Title: string;
  DocumentTypeId: number;
  TypeName: string;
  VersionScheme: DocumentVersionScheme;
  Status: DocumentStatus | null;
  LatestVersionLabel: string | null;
  ReleasedDate: string | null;
  ApprovedBy: string;
  RevisionDescription: string;
  ModifiedDate: string;
  CreatedDate: string;
  Author: string;
  LanguageId: number | null;
  LanguageCode: string | null;
  ConfidentialityClassId: number | null;
  ConfidentialityClassName: string | null;
  ProjectId: number | null;
  ProjectName: string | null;
  Company: string;
  Department: string;
  StartDate: string;
  RevisionIntervalMonths: number | null;
  LatestVersionId: number | null;
  ReviewBaselineReleasedDate: string | null;
  ReviewedBy: string;
}

interface DocumentRow {
  Id: number;
  DocumentID: string;
  Title: string;
  DocumentTypeId: number;
  TypeName: string;
  NumberPrefix: string;
  VersionScheme: DocumentVersionScheme;
  DocumentFolderPath: string;
  CreatedDate: string;
  ModifiedDate: string;
  Author: string;
  LanguageId: number | null;
  LanguageCode: string | null;
  ConfidentialityClassId: number | null;
  ConfidentialityClassName: string | null;
  ProjectId: number | null;
  ProjectName: string | null;
  Company: string;
  Department: string;
  StartDate: string;
  RevisionIntervalMonths: number | null;
}

interface VersionRow {
  Id: number;
  DocumentId: number;
  VersionDocumentID: string | null;
  SequenceNumber: number;
  VersionLabel: string;
  Status: DocumentStatus;
  ReleasedDate: string | null;
  ReviewedBy: string;
  ApprovedBy: string;
  CreatedDate: string;
  Notes: string;
}

interface VersionFileRow {
  Id: number;
  DocumentVersionId: number;
  Role: DocumentVersionFileRole;
  FileName: string;
  FilePath: string;
  ContentHash: string;
  FileSize: number;
  ModifiedDate: string;
  CreatedDate: string;
}

interface VersionFileContextRow extends VersionFileRow {
  VersionId: number;
  VersionLabel: string;
  DocumentId: number;
}

interface VersionFilesystemPreviewData {
  unmanagedPaths: string[];
  filesystemState: VersionFilesystemState;
  filesystemChanges: VersionFilesystemChange[];
}

const FILE_ROLE_SORT_ORDER: DocumentVersionFileRole[] = [
  'working',
  'concept-pdf',
  'final-pdf',
  'other'
];

const latestVersionJoin = `
  LEFT JOIN (
    SELECT DocumentId, MAX(SequenceNumber) AS LatestSequenceNumber
    FROM DocumentVersions
    GROUP BY DocumentId
  ) latest ON latest.DocumentId = d.Id
  LEFT JOIN DocumentVersions dv
    ON dv.DocumentId = latest.DocumentId
    AND dv.SequenceNumber = latest.LatestSequenceNumber
`;

export class DocumentService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly documentIdGenerator: DocumentIdGeneratorService,
    private readonly fileStorageService: FileStorageService,
    private readonly templateService: TemplateService,
    private readonly activityLogService: ActivityLogService,
    private readonly workspaceBackupService?: Pick<WorkspaceBackupService, 'createBackup'>
  ) {}

  list(rootPath: string): DocumentListItem[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare(
        `
          SELECT
            d.Id,
            COALESCE(dv.VersionDocumentID, d.DocumentID) AS DisplayDocumentID,
            d.Title,
            d.DocumentTypeId,
            dt.Name AS TypeName,
            d.VersionScheme,
            dv.Status,
            dv.VersionLabel AS LatestVersionLabel,
            dv.ReleasedDate,
            dv.ApprovedBy,
            dv.Notes AS RevisionDescription,
            d.ModifiedDate,
            d.CreatedDate,
            d.Author,
            d.LanguageId,
            l.Code AS LanguageCode,
            d.ConfidentialityClassId,
            cc.Name AS ConfidentialityClassName,
            d.ProjectId,
            p.Name AS ProjectName,
            d.Company,
            d.Department,
            d.StartDate,
            d.RevisionIntervalMonths,
            dv.Id AS LatestVersionId,
            dv.ReviewedBy,
            (
              SELECT released.ReleasedDate
              FROM DocumentVersions released
              WHERE released.DocumentId = d.Id
                AND released.ReleasedDate IS NOT NULL
              ORDER BY released.SequenceNumber DESC
              LIMIT 1
            ) AS ReviewBaselineReleasedDate
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          LEFT JOIN Languages l ON l.Id = d.LanguageId
          LEFT JOIN ConfidentialityClasses cc ON cc.Id = d.ConfidentialityClassId
          LEFT JOIN Projects p ON p.Id = d.ProjectId
          ${latestVersionJoin}
          ORDER BY d.ModifiedDate DESC, DisplayDocumentID ASC
        `
      )
      .all() as DocumentListRow[];

    return rows.map((row) => {
      const latestVersion =
        row.LatestVersionId !== null ? this.getVersionRow(context.db, row.LatestVersionId) : undefined;
      const documentVersionPreviews = this.getDocumentVersionPreviews(context, row.Id);
      const versionPreviews = [...documentVersionPreviews.values()];
      const hasMissingTrackedFiles = versionPreviews.some((preview) =>
        preview.filesystemChanges.some((change) => change.kind === 'missingTracked')
      );
      const hasFilesystemReviewIssues = versionPreviews.some(
        (preview) =>
          preview.unmanagedPaths.length > 0 ||
          preview.filesystemState !== 'clean' ||
          preview.filesystemChanges.length > 0
      );
      const latestVersionFileCount = latestVersion ? this.getVersionFileRows(context.db, latestVersion.Id).length : 0;
      const nextReviewDate = this.getNextReviewDate(
        row.ReviewBaselineReleasedDate ?? row.ReleasedDate,
        row.RevisionIntervalMonths
      );
      const effectiveDate = row.ReviewBaselineReleasedDate ?? row.ReleasedDate;
      const isOverdue =
        nextReviewDate !== null &&
        this.isDateInPast(nextReviewDate) &&
        row.Status !== 'Archived' &&
        row.Status !== 'Obsolete';

      return {
        id: row.Id,
        documentId: row.DisplayDocumentID,
        title: row.Title,
        typeId: row.DocumentTypeId,
        typeName: row.TypeName,
        versionScheme: row.VersionScheme,
        status: row.Status,
        latestVersionLabel: row.LatestVersionLabel,
        effectiveDate,
        releasedDate: row.ReleasedDate,
        approvedBy: row.ApprovedBy ?? '',
        revisionDescription: row.RevisionDescription ?? '',
        modifiedDate: row.ModifiedDate,
        createdDate: row.CreatedDate,
        author: row.Author,
        languageId: row.LanguageId,
        languageCode: row.LanguageCode,
        confidentialityClassId: row.ConfidentialityClassId,
        confidentialityClassName: row.ConfidentialityClassName,
        projectId: row.ProjectId,
        projectName: row.ProjectName,
        company: row.Company,
        department: row.Department,
        startDate: row.StartDate || row.CreatedDate.slice(0, 10),
        revisionIntervalMonths: row.RevisionIntervalMonths,
        nextReviewDate,
        isOverdue,
        healthFlags: this.getDocumentHealthFlags({
          latestVersionLabel: row.LatestVersionLabel,
          hasMissingTrackedFiles,
          hasFilesystemReviewIssues,
          modifiedDate: row.ModifiedDate,
          isOverdue
        }),
        latestVersionFileCount,
        lastActivityDate: row.ModifiedDate,
        reviewedBy: row.ReviewedBy ?? ''
      };
    });
  }

  getDetail(rootPath: string, documentRecordId: number): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    const filesystemPreviewByVersionId = this.getDocumentVersionPreviews(context, documentRecordId);
    return this.getDetailFromDatabase(context.db, documentRecordId, filesystemPreviewByVersionId);
  }

  create(rootPath: string, input: CreateDocumentInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateDocumentInput(input);
    const template = input.templateId?.trim()
      ? this.templateService.get(rootPath, input.templateId)
      : null;
    let createdDocumentFolderPath: string | null = null;

    try {
      const insertedDocumentId = context.db.transaction(() => {
        const type = context.db
          .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes WHERE Id = @id')
          .get({ id: input.documentTypeId }) as
          | { Id: number; Name: string; NumberPrefix: string }
          | undefined;

        if (!type) {
          throw new Error('The selected document type could not be found.');
        }

        const createdDate = nowIso();
        const title = input.title.trim();
        const author = input.author.trim();
        const languageId = this.normalizeOptionalReference(
          context.db,
          'Languages',
          input.languageId,
          'The selected language could not be found.'
        );
        const confidentialityClassId = this.normalizeOptionalReference(
          context.db,
          'ConfidentialityClasses',
          input.confidentialityClassId,
          'The selected confidentiality class could not be found.'
        );
        const projectId = this.normalizeOptionalReference(
          context.db,
          'Projects',
          input.projectId,
          'The selected project could not be found.'
        );
        const languageCode = this.getLookupValue(context.db, 'Languages', 'Code', languageId);
        const projectName = this.getLookupValue(context.db, 'Projects', 'Name', projectId);
        const company = (input.company ?? context.settings.defaultCompany).trim();
        const department = (input.department ?? context.settings.defaultDepartment).trim();
        const startDate = this.normalizeDocumentStartDate(input.startDate, createdDate);
        const revisionIntervalMonths = this.normalizeRevisionIntervalMonths(input.revisionIntervalMonths);
        const documentId = this.documentIdGenerator.generateNextDocumentId(context.db, context.settings, {
          numberPrefix: type.NumberPrefix,
          documentTypeName: type.Name,
          createdDate,
          title,
          author,
          languageCode,
          company,
          department,
          projectName
        });
        const documentFolderPath = this.fileStorageService.getDocumentFolderRelativePath(
          context.settings,
          type.Name,
          documentId,
          title
        );
        createdDocumentFolderPath = documentFolderPath;
        this.fileStorageService.ensureDocumentFolder(context.rootPath, documentFolderPath);

        const documentInsert = context.db
          .prepare(
            `
              INSERT INTO Documents (
                DocumentID,
                Title,
                DocumentTypeId,
                VersionScheme,
                DocumentFolderPath,
                CreatedDate,
                ModifiedDate,
                Author,
                StartDate,
                LanguageId,
                ConfidentialityClassId,
                ProjectId,
                Company,
                Department,
                RevisionIntervalMonths
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            documentId,
            title,
            input.documentTypeId,
            input.versionScheme,
            documentFolderPath,
            createdDate,
            createdDate,
            author,
            startDate,
            languageId,
            confidentialityClassId,
            projectId,
            company,
            department,
            revisionIntervalMonths
          );

        const documentRecordId = Number(documentInsert.lastInsertRowid);
        this.activityLogService.log(context.db, {
          eventType: 'document.created',
          message: template
            ? `Created document "${title}" from template "${template.name}".`
            : `Created document "${title}".`,
          documentRecordId
        });

        if (template) {
          const versionLabel = this.getNextVersionLabel(input.versionScheme, undefined, undefined);
          this.assertTemplateFilesFitVersionLayout(context, documentFolderPath, versionLabel, template.files);
          this.fileStorageService.ensureVersionFolder(
            context.rootPath,
            context.settings,
            documentFolderPath,
            versionLabel
          );

          const versionInsert = context.db
            .prepare(
              `
                INSERT INTO DocumentVersions (
                  DocumentId,
                  VersionDocumentID,
                  SequenceNumber,
                  VersionLabel,
                  Status,
                  ReleasedDate,
                  ReviewedBy,
                  ApprovedBy,
                  CreatedDate,
                  Notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `
            )
            .run(
              documentRecordId,
              documentId,
              1,
              versionLabel,
              'Draft',
              null,
              '',
              '',
              createdDate,
              `Created from template "${template.name}".`
            );
          const documentVersionId = Number(versionInsert.lastInsertRowid);
          const insertFile = context.db.prepare(
            `
              INSERT INTO DocumentVersionFiles (
                DocumentVersionId,
                Role,
                FileName,
                FilePath,
                ContentHash,
                FileSize,
                ModifiedDate,
                CreatedDate
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
          );

          const filesByRole = template.files.reduce((accumulator, file) => {
            const role = this.suggestRoleForFile(file.fileName);
            const group = accumulator.get(role) ?? [];
            group.push(file);
            accumulator.set(role, group);
            return accumulator;
          }, new Map<DocumentVersionFileRole, typeof template.files>());

          for (const role of FILE_ROLE_SORT_ORDER) {
            const templateFiles = filesByRole.get(role) ?? [];
            if (templateFiles.length === 0) {
              continue;
            }

            const importedFiles = this.fileStorageService.importManagedFiles(
              context.rootPath,
              context.settings,
              documentFolderPath,
              versionLabel,
              role,
              templateFiles.map((file) =>
                this.fileStorageService.resolveStoredFilePath(context.rootPath, file.filePath)
              )
            );

            for (const file of importedFiles) {
              insertFile.run(
                documentVersionId,
                role,
                file.fileName,
                file.relativePath,
                file.contentHash,
                file.fileSize,
                file.modifiedDate,
                createdDate
              );
            }
          }

          this.activityLogService.log(context.db, {
            eventType: 'document.version.created',
            message: `Created ${this.describeVersionActivity(documentId, versionLabel)} from template "${template.name}".`,
            documentRecordId,
            documentVersionId
          });
        }

        return documentRecordId;
      })();

      return this.getDetail(rootPath, insertedDocumentId);
    } catch (error) {
      if (createdDocumentFolderPath) {
        this.fileStorageService.deleteDocumentFolder(
          context.rootPath,
          createdDocumentFolderPath,
          context.settings
        );
      }

      throw error;
    }
  }

  createVersion(rootPath: string, input: CreateVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateVersionInput(input);

    const documentRecordId = context.db.transaction(() => {
      const document = this.getDocumentRow(context.db, input.documentRecordId);
      const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);
      const createdDate = nowIso();
      const sequenceNumber = (latestVersion?.SequenceNumber ?? 0) + 1;
      const versionLabel = this.getNextVersionLabel(document.VersionScheme, latestVersion, input.bumpType);
      const versionDocumentId = this.getNextVersionDocumentId(
        context.db,
        context.settings,
        document,
        latestVersion,
        createdDate
      );

      this.fileStorageService.ensureDocumentFolder(context.rootPath, document.DocumentFolderPath);
      this.fileStorageService.ensureVersionFolder(
        context.rootPath,
        context.settings,
        document.DocumentFolderPath,
        versionLabel
      );

      if (latestVersion && context.settings.autoMarkPreviousVersionObsolete) {
        context.db
          .prepare('UPDATE DocumentVersions SET Status = ? WHERE Id = ?')
          .run('Obsolete', latestVersion.Id);
      }

      const versionInsert = context.db
        .prepare(
          `
            INSERT INTO DocumentVersions (
              DocumentId,
              VersionDocumentID,
              SequenceNumber,
              VersionLabel,
              Status,
              ReleasedDate,
              ReviewedBy,
              ApprovedBy,
              CreatedDate,
              Notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          document.Id,
          versionDocumentId,
          sequenceNumber,
          versionLabel,
          'Draft',
          null,
          '',
          '',
          createdDate,
          input.revisionDescription.trim()
        );
      const documentVersionId = Number(versionInsert.lastInsertRowid);

      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        createdDate,
        document.Id
      );
      this.activityLogService.log(context.db, {
        eventType: 'document.version.created',
        message: `Created ${this.describeVersionActivity(versionDocumentId, versionLabel)}.`,
        documentRecordId: document.Id,
        documentVersionId
      });

      return document.Id;
    })();

    return this.getDetail(rootPath, documentRecordId);
  }

  deleteDocument(rootPath: string, input: DeleteDocumentInput): void {
    const context = this.workspaceManager.getContext(rootPath);
    const document = this.getDocumentRow(context.db, input.documentRecordId);
    this.fileStorageService.deleteDocumentFolder(
      context.rootPath,
      document.DocumentFolderPath,
      context.settings
    );

    context.db.transaction(() => {
      this.activityLogService.log(context.db, {
        eventType: 'document.deleted',
        message: `Deleted document "${document.Title}".`,
        documentRecordId: input.documentRecordId
      });
      context.db.prepare('DELETE FROM Documents WHERE Id = ?').run(input.documentRecordId);
    })();
  }

  deleteVersion(rootPath: string, input: DeleteDocumentVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, input.documentVersionId);
    const document = this.getDocumentRow(context.db, version.DocumentId);
    this.fileStorageService.deleteVersionFolder(
      context.rootPath,
      document.DocumentFolderPath,
      version.VersionLabel,
      context.settings
    );

    context.db.transaction(() => {
      this.activityLogService.log(context.db, {
        eventType: 'document.version.deleted',
        message: `Deleted ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )}.`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
      context.db
        .prepare('DELETE FROM IgnoredUnmanagedPaths WHERE DocumentVersionId = ?')
        .run(input.documentVersionId);
      context.db.prepare('DELETE FROM DocumentVersions WHERE Id = ?').run(input.documentVersionId);
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        document.Id
      );
    })();

    return this.getDetail(rootPath, document.Id);
  }

  addVersionFiles(rootPath: string, input: AddDocumentVersionFilesInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertAddVersionFilesInput(input);

    const version = this.getVersionRow(context.db, input.documentVersionId);
    this.assertVersionIsMutable(context.db, version);

    const document = this.getDocumentRow(context.db, version.DocumentId);
    const importedFiles: ManagedFileInfo[] = [];

    try {
      const newFiles = this.fileStorageService.importManagedFiles(
        context.rootPath,
        context.settings,
        document.DocumentFolderPath,
        version.VersionLabel,
        input.role,
        input.sourceFilePaths
      );
      importedFiles.push(...newFiles);

      context.db.transaction(() => {
        const createdDate = nowIso();
        const insert = context.db.prepare(
          `
            INSERT INTO DocumentVersionFiles (
              DocumentVersionId,
              Role,
              FileName,
              FilePath,
              ContentHash,
              FileSize,
              ModifiedDate,
              CreatedDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        );

        for (const file of newFiles) {
          insert.run(
            version.Id,
            input.role,
            file.fileName,
            file.relativePath,
            file.contentHash,
            file.fileSize,
            file.modifiedDate,
            createdDate
          );
        }

        context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
          createdDate,
          document.Id
        );
        this.activityLogService.log(context.db, {
          eventType: 'document.files.added',
          message: `Added ${newFiles.length} file${newFiles.length === 1 ? '' : 's'} to ${this.describeVersionActivity(
            version.VersionDocumentID?.trim() || document.DocumentID,
            version.VersionLabel
          )}.`,
          documentRecordId: document.Id,
          documentVersionId: version.Id
        });
      })();
    } catch (error) {
      for (const file of importedFiles) {
        this.fileStorageService.deleteManagedFile(context.rootPath, file.relativePath);
      }

      throw error;
    }

    return this.syncVersionFiles(rootPath, version.Id);
  }

  renameVersionFile(rootPath: string, input: RenameDocumentVersionFileInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    const document = this.getDocumentRow(context.db, fileRow.DocumentId);
    this.assertVersionIsMutable(context.db, version);
    this.assertRenameInput(input);

    const nextRelativePath = this.fileStorageService.getStoredRelativePath(
      context.settings,
      document.DocumentFolderPath,
      version.VersionLabel,
      fileRow.Role,
      input.nextFileName
    );

    const updatedFile = this.fileStorageService.renameManagedFile(
      context.rootPath,
      fileRow.FilePath,
      nextRelativePath
    );

    context.db.transaction(() => {
      context.db
        .prepare(
          `
            UPDATE DocumentVersionFiles
            SET FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
            WHERE Id = ?
          `
        )
        .run(
          updatedFile.fileName,
          updatedFile.relativePath,
          updatedFile.contentHash,
          updatedFile.fileSize,
          updatedFile.modifiedDate,
          input.fileId
        );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        document.Id
      );
      this.activityLogService.log(context.db, {
        eventType: 'document.file.renamed',
        message: `Renamed a file in ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )} to "${updatedFile.fileName}".`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  deleteVersionFile(rootPath: string, input: DeleteDocumentVersionFileInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    const document = this.getDocumentRow(context.db, fileRow.DocumentId);
    this.assertVersionIsMutable(context.db, version);

    this.fileStorageService.deleteManagedFile(context.rootPath, fileRow.FilePath);
    context.db.transaction(() => {
      context.db.prepare('DELETE FROM DocumentVersionFiles WHERE Id = ?').run(input.fileId);
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        fileRow.DocumentId
      );
      this.activityLogService.log(context.db, {
        eventType: 'document.file.deleted',
        message: `Deleted "${fileRow.FileName}" from ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )}.`,
        documentRecordId: fileRow.DocumentId,
        documentVersionId: version.Id
      });
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  changeVersionFileRole(rootPath: string, input: ChangeDocumentVersionFileRoleInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    if (!isDocumentVersionFileRole(input.role)) {
      throw new Error('Invalid file role.');
    }

    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    const document = this.getDocumentRow(context.db, fileRow.DocumentId);
    this.assertVersionIsMutable(context.db, version);

    const nextRelativePath = this.fileStorageService.getStoredRelativePath(
      context.settings,
      document.DocumentFolderPath,
      version.VersionLabel,
      input.role,
      fileRow.FileName
    );

    const updatedFile =
      this.fileStorageService.normalizeRelativePath(nextRelativePath) ===
      this.fileStorageService.normalizeRelativePath(fileRow.FilePath)
        ? this.fileStorageService.readManagedFileInfo(context.rootPath, fileRow.FilePath)
        : this.fileStorageService.moveManagedFile(context.rootPath, fileRow.FilePath, nextRelativePath);

    context.db.transaction(() => {
      context.db
        .prepare(
          `
            UPDATE DocumentVersionFiles
            SET Role = ?, FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
            WHERE Id = ?
          `
        )
        .run(
          input.role,
          updatedFile.fileName,
          updatedFile.relativePath,
          updatedFile.contentHash,
          updatedFile.fileSize,
          updatedFile.modifiedDate,
          input.fileId
        );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        document.Id
      );
      this.activityLogService.log(context.db, {
        eventType: 'document.file.roleChanged',
        message: `Moved "${fileRow.FileName}" to the ${input.role} role in ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )}.`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  syncVersionFiles(rootPath: string, documentVersionId: number): DocumentVersion {
    return this.getVersionFilesystemPreview(rootPath, documentVersionId);
  }

  getVersionFilesystemPreview(rootPath: string, documentVersionId: number): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const preview = this.buildVersionFilesystemPreview(context, version);
    return this.getVersionFromDatabase(context.db, documentVersionId, preview);
  }

  applyVersionFilesystemReconciliation(
    rootPath: string,
    documentVersionId: number,
    input: ApplyVersionFilesystemReconciliationInput = {}
  ): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const preview = this.buildVersionFilesystemPreview(context, version);
    const requestedIndexes =
      input.changeIndexes && input.changeIndexes.length > 0
        ? [...new Set(input.changeIndexes)].sort((left, right) => left - right)
        : preview.filesystemChanges.map((_change, index) => index);
    const selectedChanges = requestedIndexes
      .map((index) => preview.filesystemChanges[index])
      .filter((change): change is VersionFilesystemChange => change !== undefined);

    if (selectedChanges.length === 0) {
      return this.getVersionFromDatabase(context.db, documentVersionId, preview);
    }

    if (selectedChanges.some((change) => change.kind === 'collision' || change.kind === 'nestedUnmanaged')) {
      throw new Error('Ambiguous filesystem changes must be resolved manually before they can be applied.');
    }

    const destructiveChangeKinds = new Set<VersionFilesystemChange['kind']>(['missingTracked']);
    if (selectedChanges.some((change) => destructiveChangeKinds.has(change.kind))) {
      this.workspaceBackupService?.createBackup(rootPath, 'safety');
    }

    const now = nowIso();
    const document = this.getDocumentRow(context.db, version.DocumentId);
    context.db.transaction(() => {
      const insert = context.db.prepare(
        `
          INSERT INTO DocumentVersionFiles (
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      );
      const update = context.db.prepare(
        `
          UPDATE DocumentVersionFiles
          SET Role = ?, FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
          WHERE Id = ?
        `
      );
      const remove = context.db.prepare('DELETE FROM DocumentVersionFiles WHERE Id = ?');

      for (const change of selectedChanges) {
        switch (change.kind) {
          case 'missingTracked':
            if (change.trackedFileId) {
              remove.run(change.trackedFileId);
            }
            break;
          case 'newUnmanaged':
            if (!change.discoveredPath || !change.suggestedRole) {
              break;
            }

            {
              const discoveredAbsolutePath = this.fileStorageService.resolveStoredFilePath(
                context.rootPath,
                change.discoveredPath,
                true
              );
              if (statSync(discoveredAbsolutePath).isDirectory()) {
                throw new Error('Folder imports must be reconciled through the unmanaged path import flow.');
              }

              const fileInfo = this.fileStorageService.readManagedFileInfo(context.rootPath, change.discoveredPath);
              insert.run(
                version.Id,
                change.suggestedRole,
                fileInfo.fileName,
                fileInfo.relativePath,
                fileInfo.contentHash,
                fileInfo.fileSize,
                fileInfo.modifiedDate,
                now
              );
            }
            break;
          case 'modified':
          case 'renamed':
          case 'roleMoved':
            if (!change.trackedFileId || !change.discoveredPath) {
              break;
            }

            {
              const fileInfo = this.fileStorageService.readManagedFileInfo(context.rootPath, change.discoveredPath);
              update.run(
                change.suggestedRole ?? this.getVersionFileContextRow(context.db, change.trackedFileId).Role,
                fileInfo.fileName,
                fileInfo.relativePath,
                fileInfo.contentHash,
                fileInfo.fileSize,
                fileInfo.modifiedDate,
                change.trackedFileId
              );
            }
            break;
          default:
            break;
        }
      }

      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(now, document.Id);
      this.activityLogService.log(context.db, {
        eventType: 'document.files.reconciled',
        message: `Applied ${selectedChanges.length} filesystem change${selectedChanges.length === 1 ? '' : 's'} to ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )}.`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
    })();

    return this.getVersionFilesystemPreview(rootPath, documentVersionId);
  }

  previewVersionFile(rootPath: string, fileId: number): FilePreviewResult {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, fileId);
    const absolutePath = this.fileStorageService.resolveStoredFilePath(context.rootPath, fileRow.FilePath);
    const extension = path.extname(fileRow.FileName).toLowerCase();
    const buildDataPreviewUrl = (mimeType: string): string =>
      `data:${mimeType};base64,${readFileSync(absolutePath).toString('base64')}`;

    if (extension === '.pdf') {
      return {
        fileId,
        fileName: fileRow.FileName,
        filePath: fileRow.FilePath,
        absolutePath,
        kind: 'pdf',
        isSupported: true,
        previewUrl: buildDataPreviewUrl('application/pdf'),
        textContent: null,
        warning: null
      };
    }

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(extension)) {
      return {
        fileId,
        fileName: fileRow.FileName,
        filePath: fileRow.FilePath,
        absolutePath,
        kind: 'image',
        isSupported: true,
        previewUrl: buildDataPreviewUrl(this.getPreviewMimeType(extension)),
        textContent: null,
        warning: null
      };
    }

    if (extension === '.csv') {
      return {
        fileId,
        fileName: fileRow.FileName,
        filePath: fileRow.FilePath,
        absolutePath,
        kind: 'csv',
        isSupported: true,
        previewUrl: null,
        textContent: readFileSync(absolutePath, 'utf8').slice(0, 50000),
        warning: null
      };
    }

    if (['.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.html', '.log'].includes(extension)) {
      return {
        fileId,
        fileName: fileRow.FileName,
        filePath: fileRow.FilePath,
        absolutePath,
        kind: 'text',
        isSupported: true,
        previewUrl: null,
        textContent: readFileSync(absolutePath, 'utf8').slice(0, 50000),
        warning: null
      };
    }

    return {
      fileId,
      fileName: fileRow.FileName,
      filePath: fileRow.FilePath,
      absolutePath,
      kind: 'unsupported',
      isSupported: false,
      previewUrl: null,
      textContent: null,
      warning: 'Preview is only available for PDF, image, text, and CSV files.'
    };
  }

  compareVersions(
    rootPath: string,
    currentVersionId: number,
    previousVersionId: number
  ): VersionComparisonResult {
    const currentVersion = this.syncVersionFiles(rootPath, currentVersionId);
    const previousVersion = this.syncVersionFiles(rootPath, previousVersionId);
    const deltas: VersionFileDelta[] = [];
    const matchedPreviousIds = new Set<number>();
    const matchedCurrentIds = new Set<number>();

    for (const currentFile of currentVersion.files) {
      const exactPathMatch = previousVersion.files.find(
        (file) =>
          this.fileStorageService.normalizeRelativePath(file.filePath) ===
          this.fileStorageService.normalizeRelativePath(currentFile.filePath)
      );

      if (!exactPathMatch) {
        continue;
      }

      matchedPreviousIds.add(exactPathMatch.id);
      matchedCurrentIds.add(currentFile.id);

      if (exactPathMatch.contentHash !== currentFile.contentHash) {
        deltas.push({
          changeType: 'content-changed',
          summary: `${currentFile.fileName} content changed.`,
          before: exactPathMatch,
          after: currentFile
        });
      } else if (exactPathMatch.role !== currentFile.role) {
        deltas.push({
          changeType: 'role-changed',
          summary: `${currentFile.fileName} moved from ${exactPathMatch.role} to ${currentFile.role}.`,
          before: exactPathMatch,
          after: currentFile
        });
      }
    }

    const remainingPrevious = previousVersion.files.filter((file) => !matchedPreviousIds.has(file.id));
    const remainingCurrent = currentVersion.files.filter((file) => !matchedCurrentIds.has(file.id));

    for (const currentFile of remainingCurrent) {
      const hashMatch = remainingPrevious.find((file) => file.contentHash === currentFile.contentHash);
      if (!hashMatch) {
        continue;
      }

      matchedPreviousIds.add(hashMatch.id);
      matchedCurrentIds.add(currentFile.id);
      deltas.push({
        changeType: hashMatch.role !== currentFile.role ? 'role-changed' : 'renamed',
        summary:
          hashMatch.role !== currentFile.role
            ? `${hashMatch.fileName} moved roles and became ${currentFile.fileName}.`
            : `${hashMatch.fileName} was renamed to ${currentFile.fileName}.`,
        before: hashMatch,
        after: currentFile
      });
    }

    for (const previousFile of previousVersion.files.filter((file) => !matchedPreviousIds.has(file.id))) {
      deltas.push({
        changeType: 'removed',
        summary: `${previousFile.fileName} was removed.`,
        before: previousFile,
        after: null
      });
    }

    for (const currentFile of currentVersion.files.filter((file) => !matchedCurrentIds.has(file.id))) {
      deltas.push({
        changeType: 'added',
        summary: `${currentFile.fileName} was added.`,
        before: null,
        after: currentFile
      });
    }

    return {
      currentVersionId: currentVersion.id,
      previousVersionId: previousVersion.id,
      currentVersionLabel: currentVersion.versionLabel,
      previousVersionLabel: previousVersion.versionLabel,
      deltas,
      unchangedCount: Math.max(
        0,
        currentVersion.files.length - deltas.filter((delta) => delta.after !== null).length
      )
    };
  }

  planVersionFileImport(
    rootPath: string,
    documentVersionId: number,
    sourceFilePaths: string[]
  ): VersionFileImportPlan {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const existingFiles = this.getVersionFileRows(context.db, version.Id);
    const candidates = sourceFilePaths.map((sourceFilePath) => {
      const fileName = path.basename(sourceFilePath);
      const suggestedRole = this.suggestRoleForFile(fileName);
      const duplicateWarnings: string[] = [];
      const fileHash = this.hashAbsoluteFile(sourceFilePath);

      if (
        existingFiles.some((file) =>
          file.FileName.localeCompare(fileName, undefined, { sensitivity: 'base' }) === 0
        )
      ) {
        duplicateWarnings.push(`A file named "${fileName}" already exists in this version.`);
      }

      if (existingFiles.some((file) => file.ContentHash === fileHash)) {
        duplicateWarnings.push(`"${fileName}" matches the contents of an existing tracked file.`);
      }

      return {
        sourceFilePath,
        fileName,
        suggestedRole,
        duplicateWarnings
      };
    });
    const roleCounts = candidates.reduce((accumulator, candidate) => {
      accumulator.set(candidate.suggestedRole, (accumulator.get(candidate.suggestedRole) ?? 0) + 1);
      return accumulator;
    }, new Map<DocumentVersionFileRole, number>());
    const suggestedRole =
      [...roleCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'other';
    const warnings = candidates.flatMap((candidate) => candidate.duplicateWarnings);

    return {
      versionId: documentVersionId,
      suggestedRole,
      hasBlockingDuplicates: warnings.length > 0,
      warnings,
      candidates
    };
  }

  reconcileUnmanagedPath(
    rootPath: string,
    documentVersionId: number,
    relativePath: string
  ): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const document = this.getDocumentRow(context.db, version.DocumentId);
    this.assertVersionIsMutable(context.db, version);
    const targetAbsolutePath = this.fileStorageService.resolveStoredFilePath(context.rootPath, relativePath, true);

    if (!existsSync(targetAbsolutePath)) {
      throw new Error('The selected unmanaged path could not be found.');
    }

    const sourceFilePaths = this.collectFilesFromPath(targetAbsolutePath);
    if (sourceFilePaths.length === 0) {
      throw new Error('The selected unmanaged path does not contain any files to import.');
    }

    this.workspaceBackupService?.createBackup(rootPath, 'safety');

    const filesByRole = sourceFilePaths.reduce((accumulator, sourceFilePath) => {
      const role = this.suggestRoleForFile(path.basename(sourceFilePath));
      const group = accumulator.get(role) ?? [];
      group.push(sourceFilePath);
      accumulator.set(role, group);
      return accumulator;
    }, new Map<DocumentVersionFileRole, string[]>());

    context.db.transaction(() => {
      const insert = context.db.prepare(
        `
          INSERT INTO DocumentVersionFiles (
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      );
      const createdDate = nowIso();

      for (const [role, filePaths] of filesByRole.entries()) {
        const importedFiles: ManagedFileInfo[] = [];
        for (const sourceFilePath of filePaths) {
          const sourceRelativePath = this.fileStorageService.normalizeRelativePath(
            path.relative(context.rootPath, sourceFilePath)
          );
          const targetRelativePath = this.fileStorageService.getStoredRelativePath(
            context.settings,
            document.DocumentFolderPath,
            version.VersionLabel,
            role,
            path.basename(sourceFilePath)
          );

          if (sourceRelativePath === this.fileStorageService.normalizeRelativePath(targetRelativePath)) {
            importedFiles.push(this.fileStorageService.readManagedFileInfo(context.rootPath, sourceRelativePath));
            continue;
          }

          importedFiles.push(
            ...this.fileStorageService.importManagedFiles(
              context.rootPath,
              context.settings,
              document.DocumentFolderPath,
              version.VersionLabel,
              role,
              [sourceFilePath]
            )
          );
        }

        for (const file of importedFiles) {
          insert.run(
            version.Id,
            role,
            file.fileName,
            file.relativePath,
            file.contentHash,
            file.fileSize,
            file.modifiedDate,
            createdDate
          );
        }
      }

      context.db
        .prepare('DELETE FROM IgnoredUnmanagedPaths WHERE DocumentVersionId = ? AND RelativePath = ?')
        .run(version.Id, this.fileStorageService.normalizeRelativePath(relativePath));
      this.activityLogService.log(context.db, {
        eventType: 'document.unmanaged.imported',
        message: `Imported unmanaged path "${relativePath}" into ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )}.`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
    })();

    const normalizedRelativePath = this.fileStorageService.normalizeRelativePath(relativePath);
    const managedRelativePaths = new Set(
      sourceFilePaths.map((sourceFilePath) =>
        this.fileStorageService.normalizeRelativePath(path.relative(context.rootPath, sourceFilePath))
      )
    );
    if (!managedRelativePaths.has(normalizedRelativePath)) {
      rmSync(targetAbsolutePath, { recursive: true, force: true });
    }

    return this.syncVersionFiles(rootPath, version.Id);
  }

  ignoreUnmanagedPath(
    rootPath: string,
    documentVersionId: number,
    relativePath: string
  ): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);

    context.db
      .prepare(
        `
          INSERT OR IGNORE INTO IgnoredUnmanagedPaths (DocumentVersionId, RelativePath, CreatedDate)
          VALUES (?, ?, ?)
        `
      )
      .run(version.Id, this.fileStorageService.normalizeRelativePath(relativePath), nowIso());

    return this.syncVersionFiles(rootPath, version.Id);
  }

  updateDocument(rootPath: string, input: UpdateDocumentInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertUpdateDocumentInput(input);

    const document = this.getDocumentRow(context.db, input.documentRecordId);
    const nextTitle = input.title.trim();
    const nextFolderPath = this.fileStorageService.getDocumentFolderRelativePath(
      context.settings,
      document.TypeName,
      document.DocumentID,
      nextTitle
    );
    const shouldMoveFolder =
      this.fileStorageService.normalizeRelativePath(nextFolderPath) !==
      this.fileStorageService.normalizeRelativePath(document.DocumentFolderPath);
    const versionFileRows = shouldMoveFolder
      ? (context.db
          .prepare(
            `
              SELECT
                f.Id,
                f.FilePath
              FROM DocumentVersionFiles f
              INNER JOIN DocumentVersions v ON v.Id = f.DocumentVersionId
              WHERE v.DocumentId = @documentRecordId
            `
          )
          .all({ documentRecordId: input.documentRecordId }) as Array<{ Id: number; FilePath: string }>)
      : [];

    if (shouldMoveFolder) {
      this.fileStorageService.moveDocumentFolder(
        context.rootPath,
        document.DocumentFolderPath,
        nextFolderPath,
        context.settings
      );
    }

    try {
      const changedDate = nowIso();
      const languageId = this.normalizeOptionalReference(
        context.db,
        'Languages',
        input.languageId,
        'The selected language could not be found.'
      );
      const confidentialityClassId = this.normalizeOptionalReference(
        context.db,
        'ConfidentialityClasses',
        input.confidentialityClassId,
        'The selected confidentiality class could not be found.'
      );
      const projectId = this.normalizeOptionalReference(
        context.db,
        'Projects',
        input.projectId,
        'The selected project could not be found.'
      );
      const company = (input.company ?? '').trim();
      const department = (input.department ?? '').trim();
      const startDate = this.normalizeDocumentStartDate(input.startDate, document.CreatedDate);
      const revisionIntervalMonths = this.normalizeRevisionIntervalMonths(input.revisionIntervalMonths);

      context.db.transaction(() => {
        context.db
          .prepare(
            `
              UPDATE Documents
              SET
                Title = ?,
                ModifiedDate = ?,
                Author = ?,
                StartDate = ?,
                LanguageId = ?,
                ConfidentialityClassId = ?,
                ProjectId = ?,
                Company = ?,
                Department = ?,
                RevisionIntervalMonths = ?,
                DocumentFolderPath = ?
              WHERE Id = ?
            `
          )
          .run(
            nextTitle,
            changedDate,
            input.author.trim(),
            startDate,
            languageId,
            confidentialityClassId,
            projectId,
            company,
            department,
            revisionIntervalMonths,
            nextFolderPath,
            input.documentRecordId
          );

        if (shouldMoveFolder) {
          const updateFilePath = context.db.prepare('UPDATE DocumentVersionFiles SET FilePath = ? WHERE Id = ?');
          for (const row of versionFileRows) {
            updateFilePath.run(
              this.rewriteRelativePathPrefix(row.FilePath, document.DocumentFolderPath, nextFolderPath),
              row.Id
            );
          }
        }
        this.activityLogService.log(context.db, {
          eventType: 'document.updated',
          message: `Updated document "${nextTitle}".`,
          documentRecordId: input.documentRecordId
        });
      })();
    } catch (error) {
      if (shouldMoveFolder) {
        try {
          this.fileStorageService.moveDocumentFolder(
            context.rootPath,
            nextFolderPath,
            document.DocumentFolderPath,
            context.settings
          );
        } catch {
          // If rollback also fails, surface the original write error.
        }
      }

      throw error;
    }

    return this.getDetail(rootPath, input.documentRecordId);
  }

  updateLatestVersion(rootPath: string, input: UpdateLatestVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);
    if (!latestVersion) {
      throw new Error('Create a version before editing the latest version.');
    }

    return this.updateVersion(rootPath, {
      documentVersionId: latestVersion.Id,
      status: input.status,
      releasedDate: input.releasedDate,
      reviewedBy: input.reviewedBy,
      approvedBy: input.approvedBy,
      revisionDescription: input.revisionDescription
    });
  }

  updateVersion(rootPath: string, input: UpdateDocumentVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertStatus(input.status);

    const version = this.getVersionRow(context.db, input.documentVersionId);
    const document = this.getDocumentRow(context.db, version.DocumentId);
    const releasedDate = this.normalizeOptionalDateString(input.releasedDate);
    const reviewedBy = input.reviewedBy.trim();
    const approvedBy = input.approvedBy.trim();
    const revisionDescription = input.revisionDescription.trim();

    context.db.transaction(() => {
      context.db
        .prepare(
          `
            UPDATE DocumentVersions
            SET Status = ?, ReleasedDate = ?, ReviewedBy = ?, ApprovedBy = ?, Notes = ?
            WHERE Id = ?
          `
        )
        .run(
          input.status,
          releasedDate,
          reviewedBy,
          approvedBy,
          revisionDescription,
          version.Id
        );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(nowIso(), document.Id);
      this.activityLogService.log(context.db, {
        eventType: 'document.version.updated',
        message: `Updated ${this.describeVersionActivity(
          version.VersionDocumentID?.trim() || document.DocumentID,
          version.VersionLabel
        )} to ${input.status}.`,
        documentRecordId: document.Id,
        documentVersionId: version.Id
      });
    })();

    return this.getDetail(rootPath, document.Id);
  }

  openVersionFile(rootPath: string, fileId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, fileId);
    const resolvedPath = this.fileStorageService.resolveStoredFilePath(context.rootPath, fileRow.FilePath);
    void shell.openPath(resolvedPath);
  }

  openDocumentFolder(rootPath: string, documentRecordId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const document = this.getDocumentRow(context.db, documentRecordId);
    const folderPath = this.fileStorageService.ensureDocumentFolder(
      context.rootPath,
      this.getDocumentFolderPath(context, document)
    );
    void shell.openPath(folderPath);
  }

  openVersionFolder(rootPath: string, documentVersionId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const document = this.getDocumentRow(context.db, version.DocumentId);
    const folderPath = this.fileStorageService.ensureVersionFolder(
      context.rootPath,
      context.settings,
      this.getDocumentFolderPath(context, document),
      version.VersionLabel
    );
    void shell.openPath(folderPath);
  }

  openStoredPath(rootPath: string, relativePath: string): void {
    const context = this.workspaceManager.getContext(rootPath);
    const resolvedPath = this.fileStorageService.resolveStoredFilePath(
      context.rootPath,
      relativePath,
      true
    );
    const resolvedRootPath = path.resolve(context.rootPath);
    let targetPath = resolvedPath;

    while (!existsSync(targetPath)) {
      const parentPath = path.dirname(targetPath);
      if (parentPath === targetPath) {
        targetPath = resolvedRootPath;
        break;
      }

      const relativeToRoot = path.relative(resolvedRootPath, parentPath);
      if (
        relativeToRoot === '' ||
        relativeToRoot === '.' ||
        relativeToRoot.startsWith('..') ||
        path.isAbsolute(relativeToRoot)
      ) {
        targetPath = resolvedRootPath;
        break;
      }

      targetPath = parentPath;
    }

    void shell.openPath(targetPath);
  }

  private getDocumentVersionPreviews(
    context: ReturnType<WorkspaceManager['getContext']>,
    documentRecordId: number
  ): Map<number, VersionFilesystemPreviewData> {
    const versions = context.db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionDocumentID,
            SequenceNumber,
            VersionLabel,
            Status,
            ReleasedDate,
            ReviewedBy,
            ApprovedBy,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
        `
      )
      .all({ documentRecordId }) as VersionRow[];

    const previewByVersionId = new Map<number, VersionFilesystemPreviewData>();
    for (const version of versions) {
      previewByVersionId.set(version.Id, this.buildVersionFilesystemPreview(context, version));
    }

    return previewByVersionId;
  }

  private buildVersionFilesystemPreview(
    context: ReturnType<WorkspaceManager['getContext']>,
    version: VersionRow
  ): VersionFilesystemPreviewData {
    const document = this.getDocumentRow(context.db, version.DocumentId);
    const documentFolderPath = this.getDocumentFolderPath(context, document);
    const versionFolderPath = this.fileStorageService.getVersionFolderRelativePath(
      documentFolderPath,
      version.VersionLabel
    );
    const normalizedVersionFolderPath = this.fileStorageService.normalizeRelativePath(versionFolderPath);
    const scanResult = this.fileStorageService.scanVersionFolder(context.rootPath, versionFolderPath);
    const ignoredPaths = new Set(
      (context.db
        .prepare(
          'SELECT RelativePath FROM IgnoredUnmanagedPaths WHERE DocumentVersionId = @documentVersionId'
        )
        .all({ documentVersionId: version.Id }) as Array<{ RelativePath: string }>).map((row) =>
        this.fileStorageService.normalizeRelativePath(row.RelativePath)
      )
    );
    const existingRows = this.getVersionFileRows(context.db, version.Id);
    const existingByPath = new Map<string, VersionFileRow>(
      existingRows.map((row) => [this.fileStorageService.normalizeRelativePath(row.FilePath), row])
    );
    const matchedExistingIds = new Set<number>();
    const matchedDiscoveredIndices = new Set<number>();
    const filesystemChanges: VersionFilesystemChange[] = [];
    let filesystemState: VersionFilesystemState = 'clean';

    scanResult.files.forEach((file, index) => {
      const exactMatch = existingByPath.get(this.fileStorageService.normalizeRelativePath(file.relativePath));
      if (!exactMatch) {
        return;
      }

      matchedExistingIds.add(exactMatch.Id);
      matchedDiscoveredIndices.add(index);
      if (this.hasFileMetadataChanges(exactMatch, file)) {
        filesystemChanges.push({
          kind: 'modified',
          trackedFileId: exactMatch.Id,
          trackedPath: exactMatch.FilePath,
          discoveredPath: file.relativePath,
          suggestedRole: exactMatch.Role,
          message: `"${exactMatch.FileName}" changed on disk and needs review before DocTrack updates its metadata.`
        });
        filesystemState = 'dirty';
      }
    });

    const remainingExisting = existingRows.filter((row) => !matchedExistingIds.has(row.Id));
    const remainingDiscovered = scanResult.files
      .map((file, index) => ({ file, index }))
      .filter((item) => !matchedDiscoveredIndices.has(item.index));
    const remainingExistingByHash = new Map<string, VersionFileRow[]>();
    const remainingDiscoveredByHash = new Map<
      string,
      Array<{ file: DiscoveredVersionFile; index: number }>
    >();
    const handledExistingIds = new Set<number>();
    const handledDiscoveredIndices = new Set<number>();

    for (const row of remainingExisting) {
      const queue = remainingExistingByHash.get(row.ContentHash) ?? [];
      queue.push(row);
      remainingExistingByHash.set(row.ContentHash, queue);
    }

    for (const discovered of remainingDiscovered) {
      const queue = remainingDiscoveredByHash.get(discovered.file.contentHash) ?? [];
      queue.push(discovered);
      remainingDiscoveredByHash.set(discovered.file.contentHash, queue);
    }

    const allHashes = new Set<string>([
      ...remainingExistingByHash.keys(),
      ...remainingDiscoveredByHash.keys()
    ]);
    for (const hash of allHashes) {
      const existingGroup = remainingExistingByHash.get(hash) ?? [];
      const discoveredGroup = remainingDiscoveredByHash.get(hash) ?? [];

      if (existingGroup.length === 1 && discoveredGroup.length === 1) {
        const row = existingGroup[0]!;
        const discovered = discoveredGroup[0]!;
        handledExistingIds.add(row.Id);
        handledDiscoveredIndices.add(discovered.index);

        const suggestedRole =
          isDocumentVersionFileRole(discovered.file.inferredRole) && discovered.file.inferredRole !== 'other'
            ? discovered.file.inferredRole
            : row.Role;
        const kind = suggestedRole !== row.Role ? 'roleMoved' : 'renamed';
        filesystemChanges.push({
          kind,
          trackedFileId: row.Id,
          trackedPath: row.FilePath,
          discoveredPath: discovered.file.relativePath,
          suggestedRole,
          message:
            kind === 'roleMoved'
              ? `"${row.FileName}" was moved on disk and its tracked role would change to ${suggestedRole}.`
              : `"${row.FileName}" was moved or renamed on disk and DocTrack can relink it safely.`
        });
        filesystemState = 'dirty';
        continue;
      }

      if (existingGroup.length > 0 && discoveredGroup.length > 0) {
        for (const row of existingGroup) {
          handledExistingIds.add(row.Id);
        }

        for (const discovered of discoveredGroup) {
          handledDiscoveredIndices.add(discovered.index);
        }

        filesystemChanges.push({
          kind: 'collision',
          trackedFileId: existingGroup[0]?.Id,
          trackedPath: existingGroup[0]?.FilePath,
          discoveredPath: discoveredGroup[0]?.file.relativePath,
          message:
            `DocTrack found multiple files with the same content hash in version ${version.VersionLabel}, so it cannot safely match external moves automatically.`
        });
        filesystemState = 'ambiguous';
      }
    }

    for (const row of remainingExisting) {
      if (handledExistingIds.has(row.Id)) {
        continue;
      }

      filesystemChanges.push({
        kind: 'missingTracked',
        trackedFileId: row.Id,
        trackedPath: row.FilePath,
        suggestedRole: row.Role,
        message: `"${row.FileName}" is tracked by DocTrack but the file is missing on disk.`
      });
      filesystemState = 'dirty';
    }

    for (const discovered of remainingDiscovered) {
      if (handledDiscoveredIndices.has(discovered.index)) {
        continue;
      }

      const normalizedPath = this.fileStorageService.normalizeRelativePath(discovered.file.relativePath);
      if (this.isIgnoredFilesystemPath(normalizedPath, ignoredPaths)) {
        continue;
      }

      const suggestedRole = isDocumentVersionFileRole(discovered.file.inferredRole)
        ? discovered.file.inferredRole
        : this.suggestRoleForFile(discovered.file.fileName);
      filesystemChanges.push({
        kind: 'newUnmanaged',
        discoveredPath: discovered.file.relativePath,
        suggestedRole,
        message: `"${discovered.file.fileName}" was added on disk and is not tracked by DocTrack yet.`
      });
      filesystemState = 'dirty';
    }

    const unmanagedPaths = scanResult.unmanagedPaths.filter(
      (relativePath) =>
        !this.isIgnoredFilesystemPath(
          this.fileStorageService.normalizeRelativePath(relativePath),
          ignoredPaths
        )
    );
    for (const unmanagedPath of unmanagedPaths) {
      const relativeToVersion = path.posix.relative(normalizedVersionFolderPath, unmanagedPath);
      const kind = relativeToVersion.includes('/') ? 'nestedUnmanaged' : 'newUnmanaged';
      filesystemChanges.push({
        kind,
        discoveredPath: unmanagedPath,
        message:
          kind === 'nestedUnmanaged'
            ? `Nested content was found at "${unmanagedPath}" and must be reviewed manually.`
            : `Unmanaged content was found at "${unmanagedPath}".`
      });
      if (filesystemState !== 'ambiguous') {
        filesystemState = 'dirty';
      }
    }

    return {
      unmanagedPaths,
      filesystemState,
      filesystemChanges
    };
  }

  private isIgnoredFilesystemPath(normalizedPath: string, ignoredPaths: Set<string>): boolean {
    for (const ignoredPath of ignoredPaths) {
      if (
        normalizedPath === ignoredPath ||
        normalizedPath.startsWith(`${ignoredPath}/`)
      ) {
        return true;
      }
    }

    return false;
  }

  private getDetailFromDatabase(
    db: Database.Database,
    documentRecordId: number,
    filesystemPreviewByVersionId: Map<number, VersionFilesystemPreviewData>
  ): DocumentDetail {
    const document = this.getDocumentRow(db, documentRecordId);
    const versionRows = db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionDocumentID,
            SequenceNumber,
            VersionLabel,
            Status,
            ReleasedDate,
            ReviewedBy,
            ApprovedBy,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
        `
      )
      .all({ documentRecordId }) as VersionRow[];
    const fileRows = db
      .prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          FROM DocumentVersionFiles
          WHERE DocumentVersionId IN (
            SELECT Id FROM DocumentVersions WHERE DocumentId = @documentRecordId
          )
        `
      )
      .all({ documentRecordId }) as VersionFileRow[];

    const filesByVersionId = new Map<number, DocumentVersionFile[]>();
    for (const row of fileRows) {
      const versionFiles = filesByVersionId.get(row.DocumentVersionId) ?? [];
      versionFiles.push(this.mapVersionFileRow(row));
      filesByVersionId.set(row.DocumentVersionId, versionFiles);
    }

    const versions: DocumentVersion[] = versionRows.map((row) => ({
      ...(filesystemPreviewByVersionId.get(row.Id) ?? {
        unmanagedPaths: [],
        filesystemState: 'clean',
        filesystemChanges: []
      }),
      id: row.Id,
      documentId: row.DocumentId,
      versionDocumentId: row.VersionDocumentID?.trim() || document.DocumentID,
      sequenceNumber: row.SequenceNumber,
      versionLabel: row.VersionLabel,
      status: row.Status,
      releasedDate: row.ReleasedDate,
      reviewedBy: row.ReviewedBy,
      approvedBy: row.ApprovedBy,
      createdDate: row.CreatedDate,
      revisionDescription: row.Notes,
      files: this.sortVersionFiles(filesByVersionId.get(row.Id) ?? [])
    }));

    return {
      id: document.Id,
      documentId: versionRows[0]?.VersionDocumentID?.trim() || document.DocumentID,
      title: document.Title,
      typeId: document.DocumentTypeId,
      typeName: document.TypeName,
      versionScheme: document.VersionScheme,
      documentFolderPath: document.DocumentFolderPath,
      createdDate: document.CreatedDate,
      modifiedDate: document.ModifiedDate,
      author: document.Author,
      languageId: document.LanguageId,
      languageCode: document.LanguageCode,
      confidentialityClassId: document.ConfidentialityClassId,
      confidentialityClassName: document.ConfidentialityClassName,
      projectId: document.ProjectId,
      projectName: document.ProjectName,
      company: document.Company,
      department: document.Department,
      startDate: document.StartDate || document.CreatedDate.slice(0, 10),
      revisionIntervalMonths: document.RevisionIntervalMonths,
      versions
    };
  }

  private getVersionFromDatabase(
    db: Database.Database,
    documentVersionId: number,
    filesystemPreview: VersionFilesystemPreviewData
  ): DocumentVersion {
    const version = this.getVersionRow(db, documentVersionId);
    const files = this.getVersionFileRows(db, documentVersionId).map((row) => this.mapVersionFileRow(row));

    return {
      ...filesystemPreview,
      id: version.Id,
      documentId: version.DocumentId,
      versionDocumentId: version.VersionDocumentID?.trim() || this.getDocumentRow(db, version.DocumentId).DocumentID,
      sequenceNumber: version.SequenceNumber,
      versionLabel: version.VersionLabel,
      status: version.Status,
      releasedDate: version.ReleasedDate,
      reviewedBy: version.ReviewedBy,
      approvedBy: version.ApprovedBy,
      createdDate: version.CreatedDate,
      revisionDescription: version.Notes,
      files: this.sortVersionFiles(files)
    };
  }

  private sortVersionFiles(files: DocumentVersionFile[]): DocumentVersionFile[] {
    return [...files].sort((left, right) => {
      const leftIndex = FILE_ROLE_SORT_ORDER.indexOf(left.role);
      const rightIndex = FILE_ROLE_SORT_ORDER.indexOf(right.role);

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.fileName.localeCompare(right.fileName);
    });
  }

  private mapVersionFileRow(row: VersionFileRow): DocumentVersionFile {
    return {
      id: row.Id,
      documentVersionId: row.DocumentVersionId,
      role: row.Role,
      fileName: row.FileName,
      filePath: row.FilePath,
      contentHash: row.ContentHash,
      fileSize: row.FileSize,
      modifiedDate: row.ModifiedDate,
      createdDate: row.CreatedDate
    };
  }

  private getDocumentFolderPath(
    _context: ReturnType<WorkspaceManager['getContext']>,
    document: DocumentRow
  ): string {
    return document.DocumentFolderPath.trim();
  }

  private getDocumentRow(db: Database.Database, documentRecordId: number): DocumentRow {
    const document = db
      .prepare(
        `
          SELECT
            d.Id,
            d.DocumentID,
            d.Title,
            d.DocumentTypeId,
            dt.Name AS TypeName,
            dt.NumberPrefix,
            d.VersionScheme,
            d.DocumentFolderPath,
            d.CreatedDate,
            d.ModifiedDate,
            d.Author,
            d.LanguageId,
            l.Code AS LanguageCode,
            d.ConfidentialityClassId,
            cc.Name AS ConfidentialityClassName,
            d.ProjectId,
            p.Name AS ProjectName,
            d.Company,
            d.Department,
            d.StartDate,
            d.RevisionIntervalMonths
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          LEFT JOIN Languages l ON l.Id = d.LanguageId
          LEFT JOIN ConfidentialityClasses cc ON cc.Id = d.ConfidentialityClassId
          LEFT JOIN Projects p ON p.Id = d.ProjectId
          WHERE d.Id = @documentRecordId
        `
      )
      .get({ documentRecordId }) as DocumentRow | undefined;

    if (!document) {
      throw new Error('The selected document could not be found.');
    }

    return document;
  }

  private getVersionRow(db: Database.Database, documentVersionId: number): VersionRow {
    const version = db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionDocumentID,
            SequenceNumber,
            VersionLabel,
            Status,
            ReleasedDate,
            ReviewedBy,
            ApprovedBy,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE Id = @documentVersionId
        `
      )
      .get({ documentVersionId }) as VersionRow | undefined;

    if (!version) {
      throw new Error('The selected document version could not be found.');
    }

    return version;
  }

  private getLatestVersion(db: Database.Database, documentRecordId: number): VersionRow | undefined {
    return db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionDocumentID,
            SequenceNumber,
            VersionLabel,
            Status,
            ReleasedDate,
            ReviewedBy,
            ApprovedBy,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
          LIMIT 1
        `
      )
      .get({ documentRecordId }) as VersionRow | undefined;
  }

  private getVersionFileRows(db: Database.Database, documentVersionId: number): VersionFileRow[] {
    return db
      .prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          FROM DocumentVersionFiles
          WHERE DocumentVersionId = @documentVersionId
        `
      )
      .all({ documentVersionId }) as VersionFileRow[];
  }

  private getVersionFileContextRow(db: Database.Database, fileId: number): VersionFileContextRow {
    const row = db
      .prepare(
        `
          SELECT
            f.Id,
            f.DocumentVersionId,
            f.Role,
            f.FileName,
            f.FilePath,
            f.ContentHash,
            f.FileSize,
            f.ModifiedDate,
            f.CreatedDate,
            v.Id AS VersionId,
            v.VersionLabel,
            v.DocumentId
          FROM DocumentVersionFiles f
          INNER JOIN DocumentVersions v ON v.Id = f.DocumentVersionId
          WHERE f.Id = @fileId
        `
      )
      .get({ fileId }) as VersionFileContextRow | undefined;

    if (!row) {
      throw new Error('The selected file could not be found.');
    }

    return row;
  }

  private hasFileMetadataChanges(row: VersionFileRow, file: ManagedFileInfo): boolean {
    return (
      row.FileName !== file.fileName ||
      row.FilePath !== file.relativePath ||
      row.ContentHash !== file.contentHash ||
      row.FileSize !== file.fileSize ||
      row.ModifiedDate !== file.modifiedDate
    );
  }

  private getNextReviewDate(
    releasedDate: string | null,
    revisionIntervalMonths: number | null
  ): string | null {
    if (!releasedDate || !revisionIntervalMonths) {
      return null;
    }

    const date = new Date(releasedDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCMonth(date.getUTCMonth() + revisionIntervalMonths);
    return date.toISOString();
  }

  private isDateInPast(value: string): boolean {
    return new Date(value).getTime() < Date.now();
  }

  private getDocumentHealthFlags(input: {
    latestVersionLabel: string | null;
    hasMissingTrackedFiles: boolean;
    hasFilesystemReviewIssues: boolean;
    modifiedDate: string;
    isOverdue: boolean;
  }): DocumentHealthFlag[] {
    const flags: DocumentHealthFlag[] = [];

    if (!input.latestVersionLabel) {
      flags.push('unversionedShell');
    }

    if (input.latestVersionLabel && input.hasMissingTrackedFiles) {
      flags.push('missingFiles');
    }

    if (input.hasFilesystemReviewIssues) {
      flags.push('unmanagedPaths');
    }

    if (input.isOverdue) {
      flags.push('overdueReview');
    }

    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 180);
    if (new Date(input.modifiedDate).getTime() < staleCutoff.getTime()) {
      flags.push('staleDocument');
    }

    return flags;
  }

  private suggestRoleForFile(fileName: string): DocumentVersionFileRole {
    const normalized = fileName.toLowerCase();
    const extension = path.extname(normalized);

    if (normalized.includes('concept') && extension === '.pdf') {
      return 'concept-pdf';
    }

    if ((normalized.includes('final') || normalized.includes('released')) && extension === '.pdf') {
      return 'final-pdf';
    }

    if (extension === '.pdf') {
      return 'concept-pdf';
    }

    if (['.doc', '.docx', '.odt', '.rtf', '.txt', '.md'].includes(extension)) {
      return 'working';
    }

    return 'other';
  }

  private hashAbsoluteFile(absolutePath: string): string {
    const hash = createHash('sha256');
    hash.update(readFileSync(absolutePath));
    return hash.digest('hex');
  }

  private collectFilesFromPath(absolutePath: string): string[] {
    const stats = statSync(absolutePath);
    if (stats.isFile()) {
      return this.isHiddenFilesystemEntryName(path.basename(absolutePath)) ? [] : [absolutePath];
    }

    if (!stats.isDirectory()) {
      return [];
    }

    return readdirSync(absolutePath)
      .filter((entry) => !this.isHiddenFilesystemEntryName(entry))
      .flatMap((entry) => this.collectFilesFromPath(path.join(absolutePath, entry)));
  }

  private assertTemplateFilesFitVersionLayout(
    context: ReturnType<WorkspaceManager['getContext']>,
    documentFolderPath: string,
    versionLabel: string,
    files: Array<{ fileName: string }>
  ): void {
    const seenPaths = new Map<string, string>();

    for (const file of files) {
      const role = this.suggestRoleForFile(file.fileName);
      const relativePath = this.fileStorageService.getStoredRelativePath(
        context.settings,
        documentFolderPath,
        versionLabel,
        role,
        file.fileName
      );
      const normalizedPath = this.fileStorageService.normalizeRelativePath(relativePath);
      const existingFileName = seenPaths.get(normalizedPath);

      if (existingFileName) {
        throw new Error(
          `The selected template contains a filename collision for "${existingFileName}" in the target document layout.`
        );
      }

      seenPaths.set(normalizedPath, file.fileName);
    }
  }

  private getNextVersionDocumentId(
    db: Database.Database,
    settings: ReturnType<WorkspaceManager['getContext']>['settings'],
    document: DocumentRow,
    latestVersion: VersionRow | undefined,
    createdDate: string
  ): string {
    const currentDocumentId = latestVersion?.VersionDocumentID?.trim() || document.DocumentID;

    if (
      settings.versionManagementMode !== 'version-specific-document-id' ||
      !latestVersion
    ) {
      return currentDocumentId;
    }

    return this.documentIdGenerator.generateNextDocumentId(
      db,
      settings,
      {
        numberPrefix: document.NumberPrefix,
        documentTypeName: document.TypeName,
        createdDate,
        title: document.Title,
        author: document.Author,
        languageCode: document.LanguageCode,
        company: document.Company,
        department: document.Department,
        projectName: document.ProjectName
      }
    );
  }

  private getNextVersionLabel(
    scheme: DocumentVersionScheme,
    latestVersion: VersionRow | undefined,
    bumpType: VersionBumpType | undefined
  ): string {
    const nextSequenceNumber = (latestVersion?.SequenceNumber ?? 0) + 1;

    if (scheme === 'numeric-3') {
      return String(nextSequenceNumber).padStart(3, '0');
    }

    if (scheme === 'v-prefix') {
      return `v${nextSequenceNumber}`;
    }

    if (scheme === 'alpha-uppercase') {
      return getAlphaUppercaseVersionLabel(nextSequenceNumber);
    }

    if (!latestVersion) {
      return '1.0';
    }

    if (!bumpType || !isVersionBumpType(bumpType)) {
      throw new Error('Choose whether the next major-minor version is a major or minor bump.');
    }

    const match = latestVersion.VersionLabel.match(/^(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error('The current major-minor version label could not be parsed.');
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    return bumpType === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
  }

  private describeVersionActivity(documentId: string, versionLabel: string): string {
    return `version ${versionLabel} for document ${documentId}`;
  }

  private assertVersionIsMutable(db: Database.Database, version: VersionRow): void {
    const existingVersion = db
      .prepare('SELECT Id FROM DocumentVersions WHERE Id = @id')
      .get({ id: version.Id }) as { Id: number } | undefined;

    if (!existingVersion) {
      throw new Error('The selected version could not be found.');
    }
  }

  private assertCreateDocumentInput(input: CreateDocumentInput): void {
    if (!input.title.trim()) {
      throw new Error('Document title is required.');
    }

    if (!input.author.trim()) {
      throw new Error('Author is required.');
    }

    if (!isDocumentVersionScheme(input.versionScheme)) {
      throw new Error('Choose a version scheme for this document.');
    }

    this.normalizeDocumentStartDate(input.startDate, nowIso());
    this.normalizeRevisionIntervalMonths(input.revisionIntervalMonths);
  }

  private assertUpdateDocumentInput(input: UpdateDocumentInput): void {
    if (typeof input.documentRecordId !== 'number' || input.documentRecordId <= 0) {
      throw new Error('The selected document could not be found.');
    }

    if (!input.title.trim()) {
      throw new Error('Document title is required.');
    }

    if (!input.author.trim()) {
      throw new Error('Author is required.');
    }

    this.normalizeDocumentStartDate(input.startDate, nowIso());
    this.normalizeRevisionIntervalMonths(input.revisionIntervalMonths);
  }

  private assertCreateVersionInput(input: CreateVersionInput): void {
    if (typeof input.documentRecordId !== 'number' || input.documentRecordId <= 0) {
      throw new Error('The selected document could not be found.');
    }
  }

  private assertAddVersionFilesInput(input: AddDocumentVersionFilesInput): void {
    if (!isDocumentVersionFileRole(input.role)) {
      throw new Error('Invalid file role.');
    }

    if (input.sourceFilePaths.length === 0) {
      throw new Error('Select at least one file to add.');
    }
  }

  private assertRenameInput(input: RenameDocumentVersionFileInput): void {
    if (!input.nextFileName.trim()) {
      throw new Error('File name is required.');
    }
  }

  private assertStatus(status: string): asserts status is DocumentStatus {
    if (!['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'].includes(status)) {
      throw new Error('Invalid document status.');
    }
  }

  private normalizeOptionalReference(
    db: Database.Database,
    tableName: 'Languages' | 'ConfidentialityClasses' | 'Projects',
    value: number | null | undefined,
    errorMessage: string
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'number' || value <= 0) {
      throw new Error(errorMessage);
    }

    const row = db
      .prepare(`SELECT Id FROM ${tableName} WHERE Id = ?`)
      .get(value) as { Id: number } | undefined;

    if (!row) {
      throw new Error(errorMessage);
    }

    return row.Id;
  }

  private getLookupValue(
    db: Database.Database,
    tableName: 'Languages' | 'Projects',
    columnName: 'Code' | 'Name',
    id: number | null
  ): string | null {
    if (!id) {
      return null;
    }

    const row = db
      .prepare(`SELECT ${columnName} AS Value FROM ${tableName} WHERE Id = ?`)
      .get(id) as { Value: string } | undefined;

    return row?.Value ?? null;
  }

  private normalizeDocumentStartDate(value: string | null | undefined, fallbackDate: string): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      return fallbackDate.slice(0, 10);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('Start date must use the YYYY-MM-DD format.');
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Start date is invalid.');
    }

    return trimmed;
  }

  private normalizeRevisionIntervalMonths(value: number | null | undefined): number | null {
    if (value === undefined || value === null || value === 0) {
      return null;
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Revision interval must be a whole number of months.');
    }

    return value;
  }

  private normalizeOptionalDateString(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private isHiddenFilesystemEntryName(name: string): boolean {
    return name.startsWith('.') && name !== '.' && name !== '..';
  }

  private getPreviewMimeType(extension: string): string {
    switch (extension) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.bmp':
        return 'image/bmp';
      case '.svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }

  private rewriteRelativePathPrefix(
    relativePath: string,
    currentFolderPath: string,
    nextFolderPath: string
  ): string {
    const normalizedRelativePath = this.fileStorageService.normalizeRelativePath(relativePath);
    const normalizedCurrentFolderPath = this.fileStorageService.normalizeRelativePath(currentFolderPath);
    const normalizedNextFolderPath = this.fileStorageService.normalizeRelativePath(nextFolderPath);
    const prefix = `${normalizedCurrentFolderPath}/`;

    if (!normalizedRelativePath.startsWith(prefix)) {
      return normalizedRelativePath;
    }

    return `${normalizedNextFolderPath}/${normalizedRelativePath.slice(prefix.length)}`;
  }
}
