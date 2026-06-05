<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Nelmio\ApiDocBundle\Attribute\Model;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegisterController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserPasswordHasherInterface $hasher,
        private ValidatorInterface $validator,
    ) {}

    #[Route('/api/auth/register', methods: ['POST'])]
    #[OA\Post(
        summary: 'Create a new user account',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                    new OA\Property(property: 'password', type: 'string', minLength: 8, example: 'motdepasse123'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Account created'),
            new OA\Response(response: 400, description: 'Validation error'),
            new OA\Response(response: 409, description: 'Email already registered'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $violations = $this->validator->validate($data, new Assert\Collection([
            'email'    => [new Assert\NotBlank(), new Assert\Email()],
            'password' => [new Assert\NotBlank(), new Assert\Length(min: 8)],
        ]));

        if (count($violations) > 0) {
            return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => (string) $violations->get(0)->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        if ($this->em->getRepository(User::class)->findOneBy(['email' => $data['email']])) {
            return new JsonResponse(['error' => 'EMAIL_TAKEN', 'message' => 'Email already registered'], Response::HTTP_CONFLICT);
        }

        $user = new User($data['email'], '');
        $hashed = $this->hasher->hashPassword($user, $data['password']);
        $user = new User($data['email'], $hashed);

        $this->em->persist($user);
        $this->em->flush();

        return new JsonResponse([
            'id'         => $user->getId(),
            'email'      => $user->getEmail(),
            'created_at' => $user->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ], Response::HTTP_CREATED);
    }
}
