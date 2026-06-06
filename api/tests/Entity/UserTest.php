<?php

namespace App\Tests\Entity;

use App\Entity\User;
use PHPUnit\Framework\TestCase;

class UserTest extends TestCase
{
    public function testConstructorSetsFields(): void
    {
        $before = new \DateTimeImmutable();
        $user = new User('test@example.com', 'hashedpassword');
        $after = new \DateTimeImmutable();

        $this->assertSame('test@example.com', $user->getEmail());
        $this->assertSame('hashedpassword', $user->getPassword());
        $this->assertGreaterThanOrEqual($before, $user->getCreatedAt());
        $this->assertLessThanOrEqual($after, $user->getCreatedAt());
    }

    public function testGetUserIdentifierReturnsEmail(): void
    {
        $user = new User('test@example.com', 'hash');
        $this->assertSame('test@example.com', $user->getUserIdentifier());
    }

    public function testGetRolesReturnsRoleUser(): void
    {
        $user = new User('test@example.com', 'hash');
        $this->assertSame(['ROLE_USER'], $user->getRoles());
    }

    public function testEraseCredentialsDoesNothing(): void
    {
        $user = new User('test@example.com', 'hash');
        $user->eraseCredentials();
        $this->assertSame('hash', $user->getPassword());
    }
}
