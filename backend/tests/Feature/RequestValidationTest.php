<?php

use App\Http\Requests\RequestOtpRequest;
use App\Http\Requests\SearchUsersRequest;
use App\Http\Requests\VerifyOtpRequest;

test('foundation form requests define the expected input contracts', function () {
    expect((new SearchUsersRequest)->rules())->toHaveKey('q')
        ->and((new RequestOtpRequest)->rules())->toHaveKey('user_id')
        ->and((new VerifyOtpRequest)->rules())->toHaveKeys(['otp_request_id', 'code']);
});
