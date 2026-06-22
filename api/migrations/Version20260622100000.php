<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260622100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'files.size: INT→BIGINT, add CHECK constraint, drop redundant token index';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE files ALTER COLUMN size TYPE BIGINT');
        $this->addSql('ALTER TABLE files ADD CONSTRAINT chk_files_size CHECK (size > 0 AND size <= 1073741824)');
        $this->addSql('DROP INDEX IF EXISTS IDX_63540595F37A13B');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE files DROP CONSTRAINT chk_files_size');
        $this->addSql('ALTER TABLE files ALTER COLUMN size TYPE INT');
        $this->addSql('CREATE INDEX IDX_63540595F37A13B ON files (token)');
    }
}
