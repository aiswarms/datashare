<?php

namespace App\Controller;

use App\Entity\File;
use App\Entity\User;
use App\Service\FileStorageService;
use Doctrine\ORM\EntityManagerInterface;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[OA\Delete(
    path: '/api/files/{id}',
    summary: 'Delete a file',
    tags: ['Files'],
    security: [['Bearer' => []]],
    parameters: [
        new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
    ],
    responses: [
        new OA\Response(response: 204, description: 'File deleted'),
        new OA\Response(response: 401, description: 'Unauthorized'),
        new OA\Response(response: 403, description: 'Forbidden'),
        new OA\Response(response: 404, description: 'File not found'),
    ]
)]
#[Route('/api/files/{id}', name: 'delete_file', methods: ['DELETE'], requirements: ['id' => '\d+'])]
class DeleteFileController
{
    public function __invoke(
        int $id,
        EntityManagerInterface $em,
        FileStorageService $storage,
        #[CurrentUser] User $user,
    ): Response {
        /** @var File|null $file */
        $file = $em->getRepository(File::class)->find($id);

        if ($file === null) {
            return new JsonResponse(
                ['error' => 'FILE_NOT_FOUND', 'message' => 'File not found'],
                Response::HTTP_NOT_FOUND
            );
        }

        if ($file->getUser()?->getId() !== $user->getId()) {
            return new JsonResponse(
                ['error' => 'FORBIDDEN', 'message' => 'You do not own this file'],
                Response::HTTP_FORBIDDEN
            );
        }

        $storage->delete($file->getStoragePath());
        $em->remove($file);
        $em->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }
}
