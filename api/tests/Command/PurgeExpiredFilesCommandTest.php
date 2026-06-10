<?php

namespace App\Tests\Command;

use App\Entity\File;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;

class PurgeExpiredFilesCommandTest extends KernelTestCase
{
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->executeStatement('TRUNCATE users, files, tags RESTART IDENTITY CASCADE');
    }

    private function makeUser(): User
    {
        $user = new User('purge@test.com', 'hashed');
        $this->em->persist($user);
        return $user;
    }

    private function makeFile(User $user, \DateTimeImmutable $expiresAt): File
    {
        $file = new File();
        $file->setUser($user);
        $file->setToken(bin2hex(random_bytes(8)));
        $file->setOriginalName('test.txt');
        $file->setMimeType('text/plain');
        $file->setSize(100);
        $file->setStoragePath('uploads/test.txt');
        $file->setExpiresAt($expiresAt);
        $this->em->persist($file);
        return $file;
    }

    private function execPurge(): CommandTester
    {
        $app = new Application(self::$kernel);
        $tester = new CommandTester($app->find('app:purge-expired'));
        $tester->execute([]);
        return $tester;
    }

    public function testPurgesExpiredFiles(): void
    {
        $user = $this->makeUser();
        $expired = $this->makeFile($user, new \DateTimeImmutable('-1 day'));
        $this->em->flush();
        $expiredId = $expired->getId();

        $tester = $this->execPurge();

        $this->assertSame(0, $tester->getStatusCode());
        $this->assertStringContainsString('Purged 1 expired file(s)', $tester->getDisplay());
        $this->assertNull($this->em->find(File::class, $expiredId));
    }

    public function testKeepsNonExpiredFiles(): void
    {
        $user = $this->makeUser();
        $fresh = $this->makeFile($user, new \DateTimeImmutable('+1 day'));
        $this->em->flush();
        $freshId = $fresh->getId();

        $tester = $this->execPurge();

        $this->assertSame(0, $tester->getStatusCode());
        $this->assertStringContainsString('Purged 0 expired file(s)', $tester->getDisplay());
        $this->assertNotNull($this->em->find(File::class, $freshId));
    }

    public function testPurgesOnlyExpiredWhenMixed(): void
    {
        $user = $this->makeUser();
        $expired = $this->makeFile($user, new \DateTimeImmutable('-2 hours'));
        $fresh   = $this->makeFile($user, new \DateTimeImmutable('+2 hours'));
        $this->em->flush();
        $expiredId = $expired->getId();
        $freshId   = $fresh->getId();

        $tester = $this->execPurge();

        $this->assertSame(0, $tester->getStatusCode());
        $this->assertStringContainsString('Purged 1 expired file(s)', $tester->getDisplay());
        $this->assertNull($this->em->find(File::class, $expiredId));
        $this->assertNotNull($this->em->find(File::class, $freshId));
    }

    public function testSucceedsWithNoExpiredFiles(): void
    {
        $tester = $this->execPurge();

        $this->assertSame(0, $tester->getStatusCode());
        $this->assertStringContainsString('Purged 0 expired file(s)', $tester->getDisplay());
    }
}
