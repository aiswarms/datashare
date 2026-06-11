<?php

namespace App\Controller;

use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[OA\Get(
    path: '/api/files',
    summary: 'Get upload history for the authenticated user',
    tags: ['Files'],
    security: [['Bearer' => []]],
    responses: [
        new OA\Response(response: 200, description: 'List of uploaded files'),
        new OA\Response(response: 401, description: 'Unauthorized'),
    ]
)]
#[Route('/api/files', name: 'file_history', methods: ['GET'])]
class FileHistoryController
{
    public function __invoke(
        EntityManagerInterface $em,
        #[CurrentUser] User $user,
        #[MapQueryParameter] ?string $tag = null,
    ): JsonResponse {
        if ($tag !== null) {
            $files = $em->getRepository(File::class)
                ->createQueryBuilder('f')
                ->join('f.tags', 't')
                ->where('f.user = :user')
                ->andWhere('t.name = :tag')
                ->orderBy('f.uploadedAt', 'DESC')
                ->addOrderBy('f.id', 'DESC')
                ->setParameter('user', $user)
                ->setParameter('tag', $tag)
                ->getQuery()
                ->getResult();
        } else {
            $files = $em->getRepository(File::class)->findBy(
                ['user' => $user],
                ['uploadedAt' => 'DESC', 'id' => 'DESC']
            );
        }

        $now = new \DateTimeImmutable();

        $data = array_map(static function (File $file) use ($now): array {
            $token = $file->getToken();

            return [
                'id'                 => $file->getId(),
                'token'              => $token,
                'original_name'      => $file->getOriginalName(),
                'mime_type'          => $file->getMimeType(),
                'size'               => $file->getSize(),
                'expires_at'         => $file->getExpiresAt()->format(\DateTimeInterface::ATOM),
                'uploaded_at'        => $file->getUploadedAt()->format(\DateTimeInterface::ATOM),
                'is_expired'         => $file->getExpiresAt() < $now,
                'password_protected' => $file->getPasswordHash() !== null,
                'download_url'       => sprintf('/api/files/%s/download', $token),
                'tags'               => array_map(fn(Tag $t) => $t->getName(), $file->getTags()->toArray()),
            ];
        }, $files);

        return new JsonResponse(['data' => $data], Response::HTTP_OK);
    }
}
