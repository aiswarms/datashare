<?php

namespace App\Command;

use App\Entity\File;
use App\Service\FileStorageService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:purge-expired',
    description: 'Delete expired files from S3 storage and database',
)]
class PurgeExpiredFilesCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly FileStorageService $storage,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        /** @var File[] $files */
        $files = $this->em->getRepository(File::class)
            ->createQueryBuilder('f')
            ->where('f.expiresAt < :now')
            ->setParameter('now', new \DateTimeImmutable())
            ->getQuery()
            ->getResult();

        $purged = 0;
        $errors = 0;

        foreach ($files as $file) {
            try {
                $this->storage->delete($file->getStoragePath());
            } catch (\Throwable $e) {
                $io->warning(sprintf('Storage delete failed for "%s": %s', $file->getStoragePath(), $e->getMessage()));
                ++$errors;
            }
            $this->em->remove($file);
            ++$purged;
        }

        $this->em->flush();

        $io->success(sprintf('Purged %d expired file(s).%s', $purged, $errors ? " ($errors storage error(s))" : ''));

        return Command::SUCCESS;
    }
}
