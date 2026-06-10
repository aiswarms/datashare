<?php

namespace App\Controller;

use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\Service\FileStorageService;
use Doctrine\ORM\EntityManagerInterface;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Uid\Uuid;

#[OA\Post(
    path: '/api/files',
    summary: 'Upload a file (authenticated)',
    tags: ['Files'],
    security: [['Bearer' => []]],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\MediaType(
            mediaType: 'multipart/form-data',
            schema: new OA\Schema(
                required: ['file'],
                properties: [
                    new OA\Property(property: 'file', type: 'string', format: 'binary', description: 'File to upload (max 1 GB)'),
                    new OA\Property(property: 'expires_in_days', type: 'integer', minimum: 1, maximum: 7, default: 7, description: 'Expiration delay in days'),
                    new OA\Property(property: 'password', type: 'string', minLength: 6, description: 'Optional password protection'),
                    new OA\Property(property: 'tags[]', type: 'array', items: new OA\Items(type: 'string', maxLength: 30), description: 'Optional tags'),
                ]
            )
        )
    ),
    responses: [
        new OA\Response(response: 201, description: 'File uploaded'),
        new OA\Response(response: 400, description: 'Validation error'),
        new OA\Response(response: 401, description: 'Unauthorized'),
        new OA\Response(response: 413, description: 'File too large'),
        new OA\Response(response: 422, description: 'Forbidden file type'),
    ]
)]
#[Route('/api/files', name: 'upload', methods: ['POST'])]
class UploadController
{
    private const MAX_SIZE       = 1_073_741_824; // 1 GB
    private const MAX_EXPIRY     = 7;
    private const FORBIDDEN_EXTS = ['exe', 'bat', 'cmd', 'com', 'pif', 'vbs', 'ps1', 'msi', 'dll', 'sys', 'scr', 'sh'];

    public function __invoke(
        Request $request,
        EntityManagerInterface $em,
        FileStorageService $storage,
        #[CurrentUser] ?User $user,
    ): JsonResponse {
        $uploadedFile = $request->files->get('file');
        if (!$uploadedFile) {
            return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => 'File is required'], Response::HTTP_BAD_REQUEST);
        }

        if (!$uploadedFile->isValid()) {
            $code = $uploadedFile->getError();
            $message = \UPLOAD_ERR_INI_SIZE === $code || \UPLOAD_ERR_FORM_SIZE === $code
                ? 'File exceeds the maximum allowed size'
                : 'File upload failed';
            return new JsonResponse(['error' => 'UPLOAD_ERROR', 'message' => $message], Response::HTTP_BAD_REQUEST);
        }

        if ($uploadedFile->getSize() > self::MAX_SIZE) {
            return new JsonResponse(['error' => 'FILE_TOO_LARGE', 'message' => 'File exceeds 1 GB'], Response::HTTP_REQUEST_ENTITY_TOO_LARGE);
        }

        $ext = strtolower($uploadedFile->getClientOriginalExtension());
        if (in_array($ext, self::FORBIDDEN_EXTS, true)) {
            return new JsonResponse(['error' => 'FORBIDDEN_FILE_TYPE', 'message' => 'File type not allowed'], 422);
        }

        $expiresInDays = (int) ($request->request->get('expires_in_days', self::MAX_EXPIRY));
        if ($expiresInDays < 1 || $expiresInDays > self::MAX_EXPIRY) {
            return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => 'expires_in_days must be between 1 and 7'], Response::HTTP_BAD_REQUEST);
        }

        $password = $request->request->get('password');
        if ($password !== null && strlen($password) < 6) {
            return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => 'Password must be at least 6 characters'], Response::HTTP_BAD_REQUEST);
        }

        $rawTags = $request->request->all('tags');
        $rawTags = array_values(array_unique(array_map('trim', $rawTags)));
        foreach ($rawTags as $tag) {
            if (strlen($tag) > 30) {
                return new JsonResponse(['error' => 'VALIDATION_ERROR', 'message' => 'Each tag must be 30 characters or fewer'], Response::HTTP_BAD_REQUEST);
            }
        }

        $token       = Uuid::v4()->toRfc4122();
        $storagePath = sprintf('%s/%s', $token, $uploadedFile->getClientOriginalName());

        $storage->upload($storagePath, $uploadedFile->getPathname(), $uploadedFile->getMimeType() ?? 'application/octet-stream');

        $file = new File();
        $file->setToken($token);
        $file->setOriginalName($uploadedFile->getClientOriginalName());
        $file->setStoragePath($storagePath);
        $file->setMimeType($uploadedFile->getMimeType() ?? 'application/octet-stream');
        $file->setSize($uploadedFile->getSize());
        $file->setExpiresAt(new \DateTimeImmutable(sprintf('+%d days', $expiresInDays)));
        $file->setUser($user);

        if ($password !== null) {
            $file->setPasswordHash(password_hash($password, PASSWORD_BCRYPT));
        }

        foreach ($rawTags as $name) {
            $tag = new Tag();
            $tag->setName($name);
            $file->addTag($tag);
        }

        $em->persist($file);
        $em->flush();

        return new JsonResponse([
            'id'                 => $file->getId(),
            'token'              => $file->getToken(),
            'original_name'      => $file->getOriginalName(),
            'mime_type'          => $file->getMimeType(),
            'size'               => $file->getSize(),
            'expires_at'         => $file->getExpiresAt()->format(\DateTimeInterface::ATOM),
            'uploaded_at'        => $file->getUploadedAt()->format(\DateTimeInterface::ATOM),
            'password_protected' => $file->getPasswordHash() !== null,
            'download_url'       => sprintf('/api/files/%s/download', $file->getToken()),
            'tags'               => array_map(fn(Tag $t) => $t->getName(), $file->getTags()->toArray()),
        ], Response::HTTP_CREATED);
    }
}
