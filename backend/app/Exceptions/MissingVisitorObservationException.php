<?php

namespace App\Exceptions;

class MissingVisitorObservationException extends OperationalException
{
    protected function event(): string
    {
        return 'missing_visitor_observation';
    }
}
