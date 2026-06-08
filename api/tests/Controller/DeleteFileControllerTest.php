<?php

namespace App\Tests\Controller;

use App\Entity\File;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class DeleteFileControllerTest extends WebTestCase
{
    private $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        $conn = static::getContainer()->get('doctrine')->getConnection();
        $conn->executeStatement('TRUNCATE users, files, tags RESTART IDENTITY CASCADE');
    }

    private function register(string $email, string $password = 'password1'): void
    {
        $this->client->request('POST', '/api/auth/register', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => $email, 'password' => $password]));
    }

    private function login(string $email, string $password = 'password1'): string
    {
        $this->client->request('POST', '/api/auth/login', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => $email, 'password' => $password]));

        return json_decode($this->client->getResponse()->getContent(), true)['token'];
    }

    private function makeFile(string $name = 'test.txt'): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'delete_test_');
        file_put_contents($tmp, 'hello');
        return new UploadedFile($tmp, $name, 'text/plain', null, true);
    }

    private function upload(string $jwt, string $name = 'test.txt'): int
    {
        $this->client->request(
            'POST', '/api/files', [], ['file' => $this->makeFile($name)],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        return json_decode($this->client->getResponse()->getContent(), true)['id'];
    }

    public function testDeleteSuccess(): void
    {
        $this->register('delete@test.com');
        $jwt = $this->login('delete@test.com');
        $id  = $this->upload($jwt);

        $this->client->request('DELETE', "/api/files/{$id}", [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $this->assertResponseStatusCodeSame(204);
        $this->assertEmpty($this->client->getResponse()->getContent());
    }

    public function testDeleteRemovesFileFromDatabase(): void
    {
        $this->register('delete@test.com');
        $jwt = $this->login('delete@test.com');
        $id  = $this->upload($jwt);

        $this->client->request('DELETE', "/api/files/{$id}", [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $em   = static::getContainer()->get('doctrine')->getManager();
        $file = $em->getRepository(File::class)->find($id);
        $this->assertNull($file);
    }

    public function testDeleteReturns404WhenFileNotFound(): void
    {
        $this->register('delete@test.com');
        $jwt = $this->login('delete@test.com');

        $this->client->request('DELETE', '/api/files/99999', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $this->assertResponseStatusCodeSame(404);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FILE_NOT_FOUND', $data['error']);
    }

    public function testDeleteReturns403WhenFileOwnedByAnotherUser(): void
    {
        $this->register('alice@test.com');
        $this->register('bob@test.com');
        $jwtAlice = $this->login('alice@test.com');
        $jwtBob   = $this->login('bob@test.com');

        $id = $this->upload($jwtAlice);

        $this->client->request('DELETE', "/api/files/{$id}", [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwtBob"]);

        $this->assertResponseStatusCodeSame(403);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FORBIDDEN', $data['error']);
    }

    public function testDeleteReturns401WhenUnauthenticated(): void
    {
        $this->register('delete@test.com');
        $jwt = $this->login('delete@test.com');
        $id  = $this->upload($jwt);

        $this->client->request('DELETE', "/api/files/{$id}");

        $this->assertResponseStatusCodeSame(401);
    }

    public function testDeleteAlsoRemovesTags(): void
    {
        $this->register('delete@test.com');
        $jwt = $this->login('delete@test.com');

        $this->client->request(
            'POST', '/api/files',
            ['tags' => ['invoice', 'project']],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );
        $id = json_decode($this->client->getResponse()->getContent(), true)['id'];

        $this->client->request('DELETE', "/api/files/{$id}", [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $this->assertResponseStatusCodeSame(204);

        $conn  = static::getContainer()->get('doctrine')->getConnection();
        $count = $conn->fetchOne('SELECT COUNT(*) FROM tags WHERE file_id = ?', [$id]);
        $this->assertSame(0, (int) $count);
    }
}
