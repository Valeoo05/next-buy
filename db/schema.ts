import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  requestType: text('request_type').notNull(),
  clientName: text('client_name').notNull(),
  contactMethod: text('contact_method').notNull(),
  contact: text('contact').notNull(),
  destination: text('destination').notNull(),
  status: text('status').notNull().default('pending'),
  emailStatus: text('email_status').notNull().default('sending'),
  payload: text('payload').notNull(),
  formKey: text('form_key').notNull(),
  emailReturnHash: text('email_return_hash'),
}, table => [index('idx_requests_created_at').on(table.createdAt), uniqueIndex('idx_requests_form_key').on(table.formKey)]);

export const formTokens = sqliteTable('form_tokens', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  consumedBy: text('consumed_by'),
}, table => [index('idx_form_tokens_created_at').on(table.createdAt)]);

export const adminLoginAttempts = sqliteTable('admin_login_attempts', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  attempts: integer('attempts').notNull(),
}, table => [index('idx_admin_login_attempts_window_start').on(table.windowStart)]);

export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_admin_sessions_expires_at').on(table.expiresAt)]);

export const stockImages = sqliteTable('stock_images', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const stockProducts = sqliteTable('stock_products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull(),
  quantity: integer('quantity').notNull(),
  delivery: text('delivery').notNull().default(''),
  visible: integer('visible').notNull().default(1),
  photoId: text('photo_id'),
  gallery: text('gallery').notNull().default('[]'),
  details: text('details'),
  quantityKnown: integer('quantity_known').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [index('idx_stock_products_visible_created').on(table.visible,table.createdAt),index('idx_stock_products_photo').on(table.photoId)]);
