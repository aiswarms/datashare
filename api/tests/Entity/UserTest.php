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

    public function testSetPasswordUpdatesPassword(): void
    {
        $user = new User('test@example.com', 'oldpassword');
        $this->assertSame('oldpassword', $user->getPassword());

        $user->setPassword('newpassword');
        $this->assertSame('newpassword', $user->getPassword());
    }

    public function testGetIdMethodExists(): void
    {
        $user = new User('test@example.com', 'hash');
        // Note: getId() returns the database-assigned id which is a GeneratedValue
        // It's uninitialized for non-persisted entities, but we verify the method exists
        $this->assertTrue(method_exists($user, 'getId'));
    }
}
