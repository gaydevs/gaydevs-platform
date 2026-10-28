<?php

namespace App\Enums;

enum PollVoteCancellationReason: string
{
    case REPLACED = 'replaced';
    case WITHDRAWN = 'withdrawn';
    case OPTION_REMOVED = 'option_removed';
    case OPTION_HIDDEN = 'option_hidden';
}
