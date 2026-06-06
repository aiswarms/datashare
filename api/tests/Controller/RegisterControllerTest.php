<?php

namespace App\Tests\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class RegisterControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->executeStatement('TRUNCATE users RESTART IDENTITY CASCADE');
    }

    private function post(array $data): \Symfony\Component\HttpFoundation\Response
    {
        $this->client->request('POST', '/api/auth/register', [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($data));
        return $this->client->getResponse();
    }

    public function testRegisterSuccess(): void
    {
        $response = $this->post(['email' => 'new@example.com', 'password' => 'password123']);

        $this->assertSame(201, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('id', $body);
        $this->assertSame('new@example.com', $body['email']);
        $this->assertArrayHasKey('created_at', $body);
    }

    public function testRegisterInvalidEmail(): void
    {
        $response = $this->post(['email' => 'not-an-email', 'password' => 'password123']);

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testRegisterPasswordTooShort(): void
    {
        $response = $this->post(['email' => 'user@example.com', 'password' => 'short']);

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testRegisterMissingFields(): void
    {
        $response = $this->post([]);

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testRegisterDuplicateEmail(): void
    {
        $this->post(['email' => 'dup@example.com', 'password' => 'password123']);
        $response = $this->post(['email' => 'dup@example.com', 'password' => 'password123']);

        $this->assertSame(409, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('EMAIL_TAKEN', $body['error']);
    }
}
