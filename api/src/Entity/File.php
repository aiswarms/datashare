<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'files')]
#[ORM\Index(columns: ['token'])]
#[ORM\Index(columns: ['expires_at'])]
#[ORM\Index(columns: ['user_id'])]
class File
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $originalName;

    #[ORM\Column(length: 500)]
    private string $storagePath;

    #[ORM\Column(length: 100)]
    private string $mimeType;

    #[ORM\Column]
    private int $size;

    #[ORM\Column(length: 36, unique: true)]
    private string $token;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $passwordHash = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $uploadedAt;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $user = null;

    #[ORM\OneToMany(mappedBy: 'file', targetEntity: Tag::class, cascade: ['persist', 'remove'])]
    private Collection $tags;

    public function __construct()
    {
        $this->uploadedAt = new \DateTimeImmutable();
        $this->tags = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getOriginalName(): string { return $this->originalName; }
    public function setOriginalName(string $v): void { $this->originalName = $v; }

    public function getStoragePath(): string { return $this->storagePath; }
    public function setStoragePath(string $v): void { $this->storagePath = $v; }

    public function getMimeType(): string { return $this->mimeType; }
    public function setMimeType(string $v): void { $this->mimeType = $v; }

    public function getSize(): int { return $this->size; }
    public function setSize(int $v): void { $this->size = $v; }

    public function getToken(): string { return $this->token; }
    public function setToken(string $v): void { $this->token = $v; }

    public function getPasswordHash(): ?string { return $this->passwordHash; }
    public function setPasswordHash(?string $v): void { $this->passwordHash = $v; }

    public function getExpiresAt(): \DateTimeImmutable { return $this->expiresAt; }
    public function setExpiresAt(\DateTimeImmutable $v): void { $this->expiresAt = $v; }

    public function getUploadedAt(): \DateTimeImmutable { return $this->uploadedAt; }

    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $v): void { $this->user = $v; }

    /** @return Collection<int, Tag> */
    public function getTags(): Collection { return $this->tags; }

    public function addTag(Tag $tag): void
    {
        if (!$this->tags->contains($tag)) {
            $this->tags->add($tag);
            $tag->setFile($this);
        }
    }
}
