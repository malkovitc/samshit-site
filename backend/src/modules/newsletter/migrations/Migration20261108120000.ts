import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261108120000 extends Migration {
  async up() {
    this.addSql(`create table if not exists "newsletter_subscriber" (
      "id" text not null,
      "email" text not null,
      "locale" text not null default 'en',
      "status" text check ("status" in ('subscribed', 'unsubscribed')) not null default 'subscribed',
      "token" text not null,
      "source" text not null default 'footer',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "newsletter_subscriber_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email_unique" ON "newsletter_subscriber" (email) WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_token_unique" ON "newsletter_subscriber" (token) WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" (deleted_at) WHERE deleted_at IS NULL;`)
  }

  async down() {
    this.addSql(`drop table if exists "newsletter_subscriber" cascade;`)
  }
}
