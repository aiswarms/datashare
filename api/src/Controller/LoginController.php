<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class LoginController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserPasswordHasherInterface $hasher,
        private ValidatorInterface $validator,
        private JWTTokenManagerInterface $jwtManager,
    ) {}

    #[Route('/api/auth/login', methods: ['POST'])]
    #[OA\Post(
        summary: 'Authenticate and receive a JWT token',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                    new OA\Property(property: 'password', type: 'string', example: 'motdepasse123'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Authentication successful'),
            new OA\Response(response: 400, description: 'Validation error'),
            new OA\Response(response: 401, description: 'Invalid credentials'),
        ]
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $violations = $this->validator->validate($data, new Assert\Collection([
            'email'    => [new Assert\NotBlank(), new Assert\Email()],
            'password' => [new Assert\NotBlank()],
        ]));

        if (count($violations) > 0) {
            return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => (string) $violations->get(0)->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $data['email']]);

        if (!$user || !$this->hasher->isPasswordValid($user, $data['password'])) {
            return new JsonResponse(['error' => 'INVALID_CREDENTIALS', 'message' => 'Wrong email or password'], Response::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse([
            'token'      => $this->jwtManager->create($user),
            'expires_in' => 3600,
        ]);
    }
}
