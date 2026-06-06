<?php

namespace App\Tests\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class LoginControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->executeStatement('TRUNCATE users RESTART IDENTITY CASCADE');

        $hasher = static::getContainer()->get(UserPasswordHasherInterface::class);
        $user = new User('login@example.com', '');
        $user = new User('login@example.com', $hasher->hashPassword($user, 'correct-password'));
        $this->em->persist($user);
        $this->em->flush();
    }

    private function post(array $data): \Symfony\Component\HttpFoundation\Response
    {
        $this->client->request('POST', '/api/auth/login', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($data));
        return $this->client->getResponse();
    }

    public function testLoginSuccess(): void
    {
        $response = $this->post(['email' => 'login@example.com', 'password' => 'correct-password']);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('token', $body);
        $this->assertSame(3600, $body['expires_in']);
    }

    public function testLoginInvalidEmailFormat(): void
    {
        $response = $this->post(['email' => 'not-an-email', 'password' => 'correct-password']);

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testLoginMissingFields(): void
    {
        $response = $this->post([]);

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testLoginUserNotFound(): void
    {
        $response = $this->post(['email' => 'unknown@example.com', 'password' => 'correct-password']);

        $this->assertSame(401, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('INVALID_CREDENTIALS', $body['error']);
    }

    public function testLoginWrongPassword(): void
    {
        $response = $this->post(['email' => 'login@example.com', 'password' => 'wrong-password']);

        $this->assertSame(401, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('INVALID_CREDENTIALS', $body['error']);
    }
}
