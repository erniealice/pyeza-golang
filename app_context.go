package pyeza

import (
	"database/sql"

	"github.com/erniealice/pyeza-golang/view"
)

// RouteRegistrar is re-exported from the view sub-package so that
// domain blocks can reference pyeza.RouteRegistrar with a single import.
type RouteRegistrar = view.RouteRegistrar

// AppOption configures a domain block within an application.
// Domain packages export Block() functions that return AppOption.
// Consumer apps compose blocks in NewApp() or NewServiceAdmin().
type AppOption func(*AppContext) error

// AppContext provides shared infrastructure to domain blocks during composition.
// Typed fields for pyeza-known types (routes, labels, config).
// Opaque (any) fields for backend infrastructure — domain blocks type-assert
// to their expected types (e.g., *consumer.Container, *consumer.UseCases).
type AppContext struct {
	// === Composition targets ===

	// Routes is the route registrar for module registration.
	// Domain blocks call module.RegisterRoutes(ctx.Routes).
	Routes RouteRegistrar

	// === Shared labels ===

	// Common holds shared UI labels (buttons, pagination, filters, etc.)
	Common CommonLabels

	// Table holds shared table/grid labels (columns, actions, etc.)
	Table TableLabels

	// === Configuration ===

	// BusinessType is the configured business type (e.g., "professional", "service")
	// Used by domain blocks to load industry-specific route/label overrides from lyngua.
	BusinessType string

	// === Database ===

	// SqlDB is the raw SQL database connection for report queries.
	// May be nil for non-SQL providers.
	SqlDB *sql.DB

	// === Opaque backend infrastructure ===
	// Domain blocks type-assert these to their expected types.
	// This avoids import cycles — pyeza doesn't depend on espyna or lyngua.

	// Container is the backend infrastructure container.
	// Type-assert to *consumer.Container in domain blocks.
	Container any

	// UseCases is the use cases aggregate from the backend container.
	// Type-assert to the appropriate use cases type in domain blocks.
	UseCases any

	// DB is the database adapter for CRUD operations.
	// Type-assert to centymo.DataSource or similar in domain blocks.
	DB any

	// Translations is the translation provider for loading domain-specific labels/routes.
	// Type-assert to *lynguaV1.TranslationProvider in domain blocks.
	Translations any

	// RefChecker provides reference checking for deletable-state validation.
	// Type-assert to *reference.Checker in domain blocks.
	RefChecker any

	// === Shared cross-cutting operations ===
	// These are pre-computed closures from the consumer app's infrastructure.
	// Using function closures avoids importing hybra/esqyma proto types in pyeza.

	// UploadFile uploads a file to object storage (for attachments).
	UploadFile any // func(ctx context.Context, bucket, key string, content []byte, contentType string) error

	// ListAttachments lists attachments for an entity.
	ListAttachments any // typed by consumer — domain blocks type-assert

	// CreateAttachment creates an attachment record.
	CreateAttachment any

	// DeleteAttachment deletes an attachment record.
	DeleteAttachment any

	// NewAttachmentID generates a new attachment ID.
	NewAttachmentID any // func() string

	// UploadImage uploads an image to object storage (for product images).
	UploadImage any

	// UploadTemplate uploads a document template to storage.
	UploadTemplate any

	// SendEmail sends an email (for invoices, notifications).
	SendEmail any

	// GenerateDoc generates a document from a template + data.
	GenerateDoc any

	// ListAuditHistory lists audit trail entries for an entity.
	ListAuditHistory any

	// === Document template CRUD ===
	ListDocTemplates  any
	CreateDocTemplate any
	UpdateDocTemplate any
	DeleteDocTemplate any

	// === Entity-specific helpers ===
	// These are app-specific closures that some domain blocks need.

	// GetUsersByRoleID returns users assigned to a role (for role detail page).
	GetUsersByRoleID any

	// GetDashboardData returns dashboard statistics.
	GetDashboardData any

	// HashPassword hashes a password with bcrypt.
	HashPassword any

	// GetUserRolesMap returns role badges for all users.
	GetUserRolesMap any

	// LedgerReportingSvc provides financial reporting queries.
	LedgerReportingSvc any
}
