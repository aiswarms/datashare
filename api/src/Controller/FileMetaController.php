<?php

namespace App\Controller;

use App\Entity\File;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/files/{token}', name: 'file_meta', methods: ['GET'], requirements: ['token' => '[^/]+'])]
class FileMetaController
{
    public function __invoke(string $token, EntityManagerInterface $em): JsonResponse
    {
        /** @var File|null $file */
        $file = $em->getRepository(File::class)->findOneBy(['token' => $token]);

        if ($file === null) {
            return new JsonResponse(
                ['error' => 'FILE_NOT_FOUND', 'message' => 'File not found'],
                Response::HTTP_NOT_FOUND
            );
        }

        $now = new \DateTimeImmutable();

        return new JsonResponse([
            'token'              => $file->getToken(),
            'original_name'      => $file->getOriginalName(),
            'mime_type'          => $file->getMimeType(),
            'size'               => $file->getSize(),
            'expires_at'         => $file->getExpiresAt()->format(\DateTimeInterface::ATOM),
            'is_expired'         => $file->getExpiresAt() < $now,
            'password_protected' => $file->getPasswordHash() !== null,
            'download_url'       => sprintf('/api/files/%s/download', $file->getToken()),
        ]);
    }
}
