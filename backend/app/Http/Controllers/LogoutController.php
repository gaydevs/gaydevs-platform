<?php

namespace App\Http\Controllers;

use App\Services\AuthenticatedSessionManager;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogoutController extends Controller
{
    public function __invoke(Request $request, AuthenticatedSessionManager $sessions): Response
    {
        $sessions->logout($request);

        return response()->noContent();
    }
}
