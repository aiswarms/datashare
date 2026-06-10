<?php

namespace App\Tests\Unit\Controller;

use App\Controller\RegisterController;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\Stub;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\ConstraintViolation;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegisterControllerUnitTest extends TestCase
{
    private UserPasswordHasherInterface&Stub $hasher;
    private ValidatorInterface&Stub $validator;
    private EntityRepository&Stub $repository;
    private RegisterController $controller;

    protected function setUp(): void
    {
        $this->hasher     = $this->createStub(UserPasswordHasherInterface::class);
        $this->validator  = $this->createStub(ValidatorInterface::class);
        $this->repository = $this->createStub(EntityRepository::class);
    }

    private function makeEm(): EntityManagerInterface&Stub
    {
        $em = $this->createStub(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($this->repository);
        return $em;
    }

    private function makeRequest(array $data): Request
    {
        return Request::create('/api/auth/register', 'POST', [], [], [], [], json_encode($data));
    }

    public function testRegisterSuccess(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($this->repository);
        $em->expects($this->once())->method('persist')
            ->willReturnCallback(function (User $user): void {
                (new \ReflectionProperty(User::class, 'id'))->setValue($user, 42);
            });
        $em->expects($this->once())->method('flush');

        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn(null);
        $this->hasher->method('hashPassword')->willReturn('hashed');

        $response = (new RegisterController($em, $this->hasher, $this->validator))(
            $this->makeRequest(['email' => 'a@b.com', 'password' => 'password123'])
        );

        $this->assertSame(201, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('a@b.com', $body['email']);
    }

    public function testRegisterValidationError(): void
    {
        $violation = $this->createStub(ConstraintViolation::class);
        $violation->method('getMessage')->willReturn('This value is not a valid email address.');
        $this->validator->method('validate')->willReturn(new ConstraintViolationList([$violation]));

        $em       = $this->makeEm();
        $response = (new RegisterController($em, $this->hasher, $this->validator))(
            $this->makeRequest(['email' => 'bad', 'password' => 'password123'])
        );

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testRegisterEmailTaken(): void
    {
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn(new User('a@b.com', 'hash'));

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($this->repository);
        $em->expects($this->never())->method('persist');

        $response = (new RegisterController($em, $this->hasher, $this->validator))(
            $this->makeRequest(['email' => 'a@b.com', 'password' => 'password123'])
        );

        $this->assertSame(409, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('EMAIL_TAKEN', $body['error']);
    }
}
