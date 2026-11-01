-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_name" VARCHAR(80) NOT NULL DEFAULT '',
    "last_name" VARCHAR(80) NOT NULL DEFAULT '',
    "phone" VARCHAR(40),
    "fonction" VARCHAR(120),
    "kind" VARCHAR(10) NOT NULL DEFAULT 'usager',
    "role" VARCHAR(30) NOT NULL DEFAULT 'usager',
    "organisation_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "accepted_cgu_at" TIMESTAMPTZ,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_failed_count" INTEGER NOT NULL DEFAULT 0,
    "totp_locked_until" TIMESTAMPTZ,
    "ics_token" VARCHAR(64),
    "dashboard_prefs" TEXT,
    "list_prefs" TEXT,
    "notif_email" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "last_request" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttle" (
    "id" SERIAL NOT NULL,
    "identifier" VARCHAR(160) NOT NULL,
    "ip" VARCHAR(64) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_throttle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "description" VARCHAR(200),
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_usager" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referential" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "code" VARCHAR(40),
    "color" VARCHAR(16),
    "icon" VARCHAR(40),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "referential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "address" VARCHAR(200),
    "postal_code" VARCHAR(10),
    "city" VARCHAR(80),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "access_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace" (
    "id" SERIAL NOT NULL,
    "site_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "name" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(60),
    "slug" VARCHAR(140) NOT NULL,
    "nature_id" INTEGER,
    "description" TEXT,
    "capacity_standing" INTEGER,
    "capacity_seated" INTEGER,
    "surface" DOUBLE PRECISION,
    "floor" VARCHAR(40),
    "color" VARCHAR(16) NOT NULL DEFAULT '#e8336d',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "allowed_profiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requires_validation" BOOLEAN NOT NULL DEFAULT true,
    "open_hours" JSONB,
    "slot_step_min" INTEGER NOT NULL DEFAULT 30,
    "min_duration_min" INTEGER NOT NULL DEFAULT 60,
    "max_duration_min" INTEGER,
    "delay_min_days" INTEGER NOT NULL DEFAULT 7,
    "horizon_max_days" INTEGER NOT NULL DEFAULT 365,
    "buffer_before_min" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_min" INTEGER NOT NULL DEFAULT 0,
    "caution_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rules" TEXT,
    "instructions" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'actif',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "ics_token" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_equipement" (
    "espace_id" INTEGER NOT NULL,
    "equipement_id" INTEGER NOT NULL,
    "quantity" INTEGER,
    "note" VARCHAR(200),

    CONSTRAINT "espace_equipement_pkey" PRIMARY KEY ("espace_id","equipement_id")
);

-- CreateTable
CREATE TABLE "tarif" (
    "id" SERIAL NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "profil_id" INTEGER,
    "unite" VARCHAR(16) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" VARCHAR(120),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tarif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option" (
    "id" SERIAL NOT NULL,
    "espace_id" INTEGER,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unite" VARCHAR(16) NOT NULL DEFAULT 'forfait',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiel" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categorie_id" INTEGER,
    "description" TEXT,
    "stock_total" INTEGER NOT NULL DEFAULT 0,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unite" VARCHAR(16) NOT NULL DEFAULT 'gratuit',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_gestionnaire" (
    "espace_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" VARCHAR(16) NOT NULL DEFAULT 'gestionnaire',

    CONSTRAINT "espace_gestionnaire_pkey" PRIMARY KEY ("espace_id","user_id")
);

-- CreateTable
CREATE TABLE "indisponibilite" (
    "id" SERIAL NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "motif" VARCHAR(200),
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indisponibilite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'association',
    "name" VARCHAR(160) NOT NULL,
    "siret" VARCHAR(20),
    "rna" VARCHAR(20),
    "address" VARCHAR(200),
    "postal_code" VARCHAR(10),
    "city" VARCHAR(80),
    "email" VARCHAR(160),
    "phone" VARCHAR(40),
    "website" VARCHAR(200),
    "legal_first_name" VARCHAR(80),
    "legal_last_name" VARCHAR(80),
    "legal_appointed_at" DATE,
    "profil_id" INTEGER,
    "notes" TEXT,
    "validated_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "organisation_id" INTEGER,
    "user_id" TEXT,
    "agent_id" TEXT,
    "title" VARCHAR(160) NOT NULL,
    "nature_id" INTEGER,
    "description" TEXT,
    "participants" INTEGER,
    "is_public_event" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(16) NOT NULL DEFAULT 'a_traiter',
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "recurrence" JSONB,
    "setup_min" INTEGER NOT NULL DEFAULT 0,
    "teardown_min" INTEGER NOT NULL DEFAULT 0,
    "decision_at" TIMESTAMPTZ,
    "decision_by" VARCHAR(160),
    "refusal_reason" TEXT,
    "cancel_reason" TEXT,
    "internal_notes" TEXT,
    "montant_ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montant_ttc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acompte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratuit" BOOLEAN NOT NULL DEFAULT false,
    "convention_document_id" INTEGER,
    "signature_channel" VARCHAR(10),
    "signature_sent_at" TIMESTAMPTZ,
    "signature_code_hash" VARCHAR(128),
    "signature_expires_at" TIMESTAMPTZ,
    "signature_attempts" INTEGER NOT NULL DEFAULT 0,
    "signed_at" TIMESTAMPTZ,
    "signer_name" VARCHAR(160),
    "signer_ip" VARCHAR(64),
    "source" VARCHAR(16) NOT NULL DEFAULT 'backoffice',
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creneau" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "espace_id" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'prevu',
    "note" VARCHAR(200),

    CONSTRAINT "creneau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_option" (
    "reservation_id" INTEGER NOT NULL,
    "option_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "reservation_option_pkey" PRIMARY KEY ("reservation_id","option_id")
);

-- CreateTable
CREATE TABLE "reservation_materiel" (
    "reservation_id" INTEGER NOT NULL,
    "materiel_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "montant" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "reservation_materiel_pkey" PRIMARY KEY ("reservation_id","materiel_id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "author_id" TEXT,
    "author_kind" VARCHAR(10) NOT NULL DEFAULT 'agent',
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_history" (
    "id" SERIAL NOT NULL,
    "reservation_id" INTEGER NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "comment" TEXT,
    "performed_by" VARCHAR(160),
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" SERIAL NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'piece',
    "category_id" INTEGER,
    "title" VARCHAR(160),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "site_id" INTEGER,
    "espace_id" INTEGER,
    "materiel_id" INTEGER,
    "organisation_id" INTEGER,
    "reservation_id" INTEGER,
    "subvention_id" INTEGER,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_content" (
    "document_id" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "thumb" BYTEA,

    CONSTRAINT "document_content_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "facture" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "reservation_id" INTEGER,
    "organisation_id" INTEGER,
    "type" VARCHAR(10) NOT NULL DEFAULT 'solde',
    "libelle" VARCHAR(200) NOT NULL,
    "montant_ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montant_ttc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(12) NOT NULL DEFAULT 'a_payer',
    "due_at" DATE,
    "paid_at" TIMESTAMPTZ,
    "pdf_document_id" INTEGER,
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiement" (
    "id" SERIAL NOT NULL,
    "facture_id" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "mode" VARCHAR(12) NOT NULL,
    "reference" VARCHAR(80),
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" TEXT,

    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subvention" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "organisation_id" INTEGER NOT NULL,
    "exercice" INTEGER NOT NULL,
    "objet" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(20) NOT NULL DEFAULT 'fonctionnement',
    "montant_demande" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montant_accorde" DOUBLE PRECISION,
    "status" VARCHAR(12) NOT NULL DEFAULT 'deposee',
    "budget_total" DOUBLE PRECISION,
    "beneficiaires" INTEGER,
    "decision_at" TIMESTAMPTZ,
    "decision_note" TEXT,
    "instructeur" VARCHAR(160),
    "deposited_by" VARCHAR(160),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subvention_avis" (
    "id" SERIAL NOT NULL,
    "subvention_id" INTEGER NOT NULL,
    "author_id" TEXT,
    "avis" VARCHAR(12) NOT NULL,
    "montant" DOUBLE PRECISION,
    "commentaire" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subvention_avis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "link" VARCHAR(300),
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_log" (
    "id" SERIAL NOT NULL,
    "channel" VARCHAR(8) NOT NULL DEFAULT 'email',
    "recipient" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "template_key" VARCHAR(60),
    "status" VARCHAR(10) NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "reservation_id" INTEGER,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_log" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(160) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "category" VARCHAR(32),
    "detail" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_run" (
    "id" SERIAL NOT NULL,
    "task" VARCHAR(64) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "status" VARCHAR(16) NOT NULL DEFAULT 'running',
    "message" TEXT,

    CONSTRAINT "scheduler_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence" (
    "key" VARCHAR(32) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_ics_token_key" ON "user"("ics_token");

-- CreateIndex
CREATE INDEX "user_organisation_id_idx" ON "user"("organisation_id");

-- CreateIndex
CREATE INDEX "user_kind_role_idx" ON "user"("kind", "role");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "auth_account_user_id_idx" ON "auth_account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "two_factor_user_id_idx" ON "two_factor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "login_throttle_identifier_ip_key" ON "login_throttle"("identifier", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE INDEX "referential_kind_position_idx" ON "referential"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "referential_kind_label_key" ON "referential"("kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "email_template_key_key" ON "email_template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "site_slug_key" ON "site"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "espace_slug_key" ON "espace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "espace_ics_token_key" ON "espace"("ics_token");

-- CreateIndex
CREATE INDEX "espace_site_id_idx" ON "espace"("site_id");

-- CreateIndex
CREATE INDEX "espace_parent_id_idx" ON "espace"("parent_id");

-- CreateIndex
CREATE INDEX "espace_nature_id_idx" ON "espace"("nature_id");

-- CreateIndex
CREATE INDEX "tarif_espace_id_idx" ON "tarif"("espace_id");

-- CreateIndex
CREATE INDEX "option_espace_id_idx" ON "option"("espace_id");

-- CreateIndex
CREATE INDEX "indisponibilite_espace_id_start_at_idx" ON "indisponibilite"("espace_id", "start_at");

-- CreateIndex
CREATE INDEX "organisation_type_idx" ON "organisation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_numero_key" ON "reservation"("numero");

-- CreateIndex
CREATE INDEX "reservation_espace_id_start_at_idx" ON "reservation"("espace_id", "start_at");

-- CreateIndex
CREATE INDEX "reservation_organisation_id_idx" ON "reservation"("organisation_id");

-- CreateIndex
CREATE INDEX "reservation_user_id_idx" ON "reservation"("user_id");

-- CreateIndex
CREATE INDEX "reservation_status_idx" ON "reservation"("status");

-- CreateIndex
CREATE INDEX "reservation_start_at_idx" ON "reservation"("start_at");

-- CreateIndex
CREATE INDEX "creneau_espace_id_start_at_idx" ON "creneau"("espace_id", "start_at");

-- CreateIndex
CREATE INDEX "creneau_reservation_id_idx" ON "creneau"("reservation_id");

-- CreateIndex
CREATE INDEX "message_reservation_id_created_at_idx" ON "message"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_read_at_idx" ON "message"("read_at");

-- CreateIndex
CREATE INDEX "reservation_history_reservation_id_idx" ON "reservation_history"("reservation_id");

-- CreateIndex
CREATE INDEX "document_espace_id_idx" ON "document"("espace_id");

-- CreateIndex
CREATE INDEX "document_site_id_idx" ON "document"("site_id");

-- CreateIndex
CREATE INDEX "document_organisation_id_idx" ON "document"("organisation_id");

-- CreateIndex
CREATE INDEX "document_reservation_id_idx" ON "document"("reservation_id");

-- CreateIndex
CREATE INDEX "document_subvention_id_idx" ON "document"("subvention_id");

-- CreateIndex
CREATE UNIQUE INDEX "facture_numero_key" ON "facture"("numero");

-- CreateIndex
CREATE INDEX "facture_reservation_id_idx" ON "facture"("reservation_id");

-- CreateIndex
CREATE INDEX "facture_status_idx" ON "facture"("status");

-- CreateIndex
CREATE INDEX "paiement_facture_id_idx" ON "paiement"("facture_id");

-- CreateIndex
CREATE UNIQUE INDEX "subvention_numero_key" ON "subvention"("numero");

-- CreateIndex
CREATE INDEX "subvention_organisation_id_idx" ON "subvention"("organisation_id");

-- CreateIndex
CREATE INDEX "subvention_exercice_status_idx" ON "subvention"("exercice", "status");

-- CreateIndex
CREATE INDEX "subvention_avis_subvention_id_idx" ON "subvention_avis"("subvention_id");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "mail_log_sent_at_idx" ON "mail_log"("sent_at");

-- CreateIndex
CREATE INDEX "action_log_created_at_idx" ON "action_log"("created_at");

-- CreateIndex
CREATE INDEX "scheduler_run_task_started_at_idx" ON "scheduler_run"("task", "started_at");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace" ADD CONSTRAINT "espace_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace" ADD CONSTRAINT "espace_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "espace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace" ADD CONSTRAINT "espace_nature_id_fkey" FOREIGN KEY ("nature_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_equipement" ADD CONSTRAINT "espace_equipement_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_equipement" ADD CONSTRAINT "espace_equipement_equipement_id_fkey" FOREIGN KEY ("equipement_id") REFERENCES "referential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option" ADD CONSTRAINT "option_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiel" ADD CONSTRAINT "materiel_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_gestionnaire" ADD CONSTRAINT "espace_gestionnaire_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_gestionnaire" ADD CONSTRAINT "espace_gestionnaire_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indisponibilite" ADD CONSTRAINT "indisponibilite_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation" ADD CONSTRAINT "organisation_profil_id_fkey" FOREIGN KEY ("profil_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_nature_id_fkey" FOREIGN KEY ("nature_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneau" ADD CONSTRAINT "creneau_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneau" ADD CONSTRAINT "creneau_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_option" ADD CONSTRAINT "reservation_option_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_option" ADD CONSTRAINT "reservation_option_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_materiel" ADD CONSTRAINT "reservation_materiel_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_materiel" ADD CONSTRAINT "reservation_materiel_materiel_id_fkey" FOREIGN KEY ("materiel_id") REFERENCES "materiel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_history" ADD CONSTRAINT "reservation_history_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "referential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_materiel_id_fkey" FOREIGN KEY ("materiel_id") REFERENCES "materiel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_subvention_id_fkey" FOREIGN KEY ("subvention_id") REFERENCES "subvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_content" ADD CONSTRAINT "document_content_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention" ADD CONSTRAINT "subvention_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention_avis" ADD CONSTRAINT "subvention_avis_subvention_id_fkey" FOREIGN KEY ("subvention_id") REFERENCES "subvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subvention_avis" ADD CONSTRAINT "subvention_avis_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

