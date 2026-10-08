CREATE TABLE `stock_images` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`delivery` text DEFAULT '' NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`photo_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stock_products_visible_created` ON `stock_products` (`visible`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_products_photo` ON `stock_products` (`photo_id`);