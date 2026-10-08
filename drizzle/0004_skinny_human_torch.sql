ALTER TABLE `stock_products` ADD `gallery` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_products` ADD `quantity_known` integer DEFAULT 1 NOT NULL;