<?php

namespace App\OpenApi;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\PathItem;
use ApiPlatform\OpenApi\Model\RequestBody;
use ApiPlatform\OpenApi\OpenApi;

class OpenApiFactory implements OpenApiFactoryInterface
{
    public function __construct(private OpenApiFactoryInterface $decorated) {}

    public function __invoke(array $context = []): OpenApi
    {
        $openApi = ($this->decorated)($context);

        $openApi->getPaths()->addPath('/api/auth/register', new PathItem(
            post: new Operation(
                operationId: 'register',
                tags: ['Auth'],
                summary: 'Create a new user account',
                requestBody: new RequestBody(
                    required: true,
                    content: new \ArrayObject([
                        'application/json' => [
                            'schema' => [
                                'type' => 'object',
                                'required' => ['email', 'password'],
                                'properties' => [
                                    'email'    => ['type' => 'string', 'format' => 'email', 'example' => 'user@example.com'],
                                    'password' => ['type' => 'string', 'minLength' => 8, 'example' => 'motdepasse123'],
                                ],
                            ],
                        ],
                    ]),
                ),
                responses: new \ArrayObject([
                    '201' => ['description' => 'Account created'],
                    '400' => ['description' => 'Validation error'],
                    '409' => ['description' => 'Email already registered'],
                ]),
            ),
        ));

        return $openApi;
    }
}
