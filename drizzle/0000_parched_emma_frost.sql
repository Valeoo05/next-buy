CREATE TABLE `form_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`consumed_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_form_tokens_created_at` ON `form_tokens` (`created_at`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`request_type` text NOT NULL,
	`client_name` text NOT NULL,
	`contact_method` text NOT NULL,
	`contact` text NOT NULL,
	`destination` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`email_status` text DEFAULT 'sending' NOT NULL,
	`payload` text NOT NULL,
	`form_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_requests_created_at` ON `requests` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_requests_form_key` ON `requests` (`form_key`);