<?php

namespace App\Http\Controllers;

use App\Actions\SearchUsers;
use App\Http\Requests\SearchUsersRequest;
use Illuminate\Http\JsonResponse;

class UserSearchController extends Controller
{
    public function __invoke(SearchUsersRequest $request, SearchUsers $search): JsonResponse
    {
        return response()->json($search->handle(
            (string) $request->validated('q', ''),
            $request->ip(),
        ));
    }
}
