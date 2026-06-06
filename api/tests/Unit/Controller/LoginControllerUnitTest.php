<?php

namespace App\Tests\Unit\Controller;

use App\Controller\LoginController;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\ConstraintViolation;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class LoginControllerUnitTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private UserPasswordHasherInterface&MockObject $hasher;
    private ValidatorInterface&MockObject $validator;
    private JWTTokenManagerInterface&MockObject $jwtManager;
    private EntityRepository&MockObject $repository;
    private LoginController $controller;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->hasher = $this->createMock(UserPasswordHasherInterface::class);
        $this->validator = $this->createMock(ValidatorInterface::class);
        $this->jwtManager = $this->createMock(JWTTokenManagerInterface::class);
        $this->repository = $this->createMock(EntityRepository::class);

        $this->em->method('getRepository')->with(User::class)->willReturn($this->repository);

        $this->controller = new LoginController($this->em, $this->hasher, $this->validator, $this->jwtManager);
    }

    private function makeRequest(array $data): Request
    {
        return Request::create('/api/auth/login', 'POST', [], [], [], [], json_encode($data));
    }

    public function testLoginSuccess(): void
    {
        $user = new User('a@b.com', 'hashed');
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn($user);
        $this->hasher->method('isPasswordValid')->willReturn(true);
        $this->jwtManager->method('create')->willReturn('jwt.token.here');

        $response = ($this->controller)($this->makeRequest(['email' => 'a@b.com', 'password' => 'correct']));

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('jwt.token.here', $body['token']);
        $this->assertSame(3600, $body['expires_in']);
    }

    public function testLoginValidationError(): void
    {
        $violation = $this->createMock(ConstraintViolation::class);
        $violation->method('getMessage')->willReturn('This value is not a valid email address.');
        $this->validator->method('validate')->willReturn(new ConstraintViolationList([$violation]));

        $response = ($this->controller)($this->makeRequest(['email' => 'bad', 'password' => 'pass']));

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testLoginUserNotFound(): void
    {
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn(null);

        $response = ($this->controller)($this->makeRequest(['email' => 'unknown@b.com', 'password' => 'pass']));

        $this->assertSame(401, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('INVALID_CREDENTIALS', $body['error']);
    }

    public function testLoginWrongPassword(): void
    {
        $user = new User('a@b.com', 'hashed');
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn($user);
        $this->hasher->method('isPasswordValid')->willReturn(false);

        $response = ($this->controller)($this->makeRequest(['email' => 'a@b.com', 'password' => 'wrong']));

        $this->assertSame(401, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('INVALID_CREDENTIALS', $body['error']);
    }
}
