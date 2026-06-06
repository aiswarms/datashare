<?php

namespace App\Controller;

use App\Entity\File;
use App\Service\FileStorageService;
use Doctrine\ORM\EntityManagerInterface;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

#[OA\Get(
    path: '/api/files/{token}/download',
    summary: 'Download a file',
    tags: ['Files'],
    parameters: [
        new OA\Parameter(name: 'token', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        new OA\Parameter(name: 'password', in: 'query', required: false, schema: new OA\Schema(type: 'string')),
    ],
    responses: [
        new OA\Response(response: 200, description: 'File binary stream'),
        new OA\Response(response: 401, description: 'Wrong password'),
        new OA\Response(response: 404, description: 'File not found or expired'),
    ]
)]
#[Route('/api/files/{token}/download', name: 'download', methods: ['GET'])]
class DownloadController
{
    public function __invoke(
        string $token,
        Request $request,
        EntityManagerInterface $em,
        FileStorageService $storage,
    ): Response {
        /** @var File|null $file */
        $file = $em->getRepository(File::class)->findOneBy(['token' => $token]);

        if ($file === null || $file->getExpiresAt() < new \DateTimeImmutable()) {
            return new JsonResponse(
                ['error' => 'FILE_NOT_FOUND', 'message' => 'File not found or expired'],
                Response::HTTP_NOT_FOUND
            );
        }

        if ($file->getPasswordHash() !== null) {
            $password = (string) $request->query->get('password', '');
            if (!password_verify($password, $file->getPasswordHash())) {
                return new JsonResponse(
                    ['error' => 'WRONG_PASSWORD', 'message' => 'Incorrect password'],
                    Response::HTTP_UNAUTHORIZED
                );
            }
        }

        $stream = $storage->getStream($file->getStoragePath());

        return new StreamedResponse(
            static function () use ($stream): void {
                while (!$stream->eof()) {
                    echo $stream->read(8192);
                    flush();
                }
            },
            Response::HTTP_OK,
            [
                'Content-Type'        => $file->getMimeType(),
                'Content-Disposition' => sprintf('attachment; filename="%s"', addslashes($file->getOriginalName())),
                'Content-Length'      => (string) $file->getSize(),
            ]
        );
    }
}
