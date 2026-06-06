<?php

namespace App\Tests\Unit\Controller;

use App\Controller\RegisterController;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\ConstraintViolation;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegisterControllerUnitTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private UserPasswordHasherInterface&MockObject $hasher;
    private ValidatorInterface&MockObject $validator;
    private EntityRepository&MockObject $repository;
    private RegisterController $controller;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->hasher = $this->createMock(UserPasswordHasherInterface::class);
        $this->validator = $this->createMock(ValidatorInterface::class);
        $this->repository = $this->createMock(EntityRepository::class);

        $this->em->method('getRepository')->with(User::class)->willReturn($this->repository);

        $this->controller = new RegisterController($this->em, $this->hasher, $this->validator);
    }

    private function makeRequest(array $data): Request
    {
        return Request::create('/api/auth/register', 'POST', [], [], [], [], json_encode($data));
    }

    public function testRegisterSuccess(): void
    {
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn(null);
        $this->hasher->method('hashPassword')->willReturn('hashed');
        $this->em->expects($this->once())->method('persist')
            ->willReturnCallback(function (User $user): void {
                (new \ReflectionProperty(User::class, 'id'))->setValue($user, 42);
            });
        $this->em->expects($this->once())->method('flush');

        $response = ($this->controller)($this->makeRequest(['email' => 'a@b.com', 'password' => 'password123']));

        $this->assertSame(201, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('a@b.com', $body['email']);
    }

    public function testRegisterValidationError(): void
    {
        $violation = $this->createMock(ConstraintViolation::class);
        $violation->method('getMessage')->willReturn('This value is not a valid email address.');
        $this->validator->method('validate')->willReturn(new ConstraintViolationList([$violation]));

        $response = ($this->controller)($this->makeRequest(['email' => 'bad', 'password' => 'password123']));

        $this->assertSame(400, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $body['error']);
    }

    public function testRegisterEmailTaken(): void
    {
        $this->validator->method('validate')->willReturn(new ConstraintViolationList());
        $this->repository->method('findOneBy')->willReturn(new User('a@b.com', 'hash'));
        $this->em->expects($this->never())->method('persist');

        $response = ($this->controller)($this->makeRequest(['email' => 'a@b.com', 'password' => 'password123']));

        $this->assertSame(409, $response->getStatusCode());
        $body = json_decode($response->getContent(), true);
        $this->assertSame('EMAIL_TAKEN', $body['error']);
    }
}
