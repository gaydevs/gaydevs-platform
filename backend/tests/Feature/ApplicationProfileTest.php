<?php

use App\Services\ApplicationProfileProbe;
use App\Services\ApplicationProfileUrl;
use App\Services\ApplicationProfileVerifier;
use Illuminate\Validation\ValidationException;

test('handles and pasted profile URLs normalize to the approved hosts', function () {
    $urls = app(ApplicationProfileUrl::class);
    expect($urls->normalize('linkedin', 'https://www.linkedin.com/in/test-person/'))->toBe('https://linkedin.com/in/test-person')
        ->and($urls->normalize('github', '@test-person'))->toBe('https://github.com/test-person')
        ->and($urls->normalize('instagram', 'instagram.com/test.person/'))->toBe('https://instagram.com/test.person');
});

test('profile validation rejects invalid schemes hosts credentials ports and paths', function (string $url) {
    expect(fn () => app(ApplicationProfileUrl::class)->normalize('github', $url))->toThrow(ValidationException::class);
})->with(['http://github.com/test', 'https://github.com.example.test/test', 'https://user@github.com/test', 'https://github.com:443/test', 'https://github.com/test/repo', 'https://github.com/test?x=1', 'https://github.com/%2e%2e', 'https://github.com/login', 'https://127.0.0.1/test']);

test('DNS private or mixed addresses never reach transport', function (array $ips) {
    $probe = Mockery::mock(ApplicationProfileProbe::class);
    $probe->shouldReceive('resolve')->once()->with('api.github.com')->andReturn($ips);
    $probe->shouldNotReceive('lookup');
    $verifier = new ApplicationProfileVerifier(app(ApplicationProfileUrl::class), $probe);
    expect($verifier->check('github', 'test-person'))->toBe('inconclusive');
})->with([[['127.0.0.1']], [['169.254.169.254']], [['10.0.0.1']], [['8.8.8.8', '192.168.1.1']], [['::1']], [['::ffff:127.0.0.1']], [['100.64.0.1']]]);

test('profile verifier pins vetted IP and classifies only matching positive evidence or gone', function (int $status, ?string $login, string $expected) {
    $probe = Mockery::mock(ApplicationProfileProbe::class);
    $probe->shouldReceive('resolve')->once()->with('api.github.com')->andReturn(['8.8.8.8']);
    $probe->shouldReceive('lookup')->once()->with('test-person', '8.8.8.8', Mockery::on(fn ($ms) => $ms > 0 && $ms <= 3000))->andReturn(['status' => $status, 'login' => $login]);
    $verifier = new ApplicationProfileVerifier(app(ApplicationProfileUrl::class), $probe);
    expect($verifier->check('github', 'test-person'))->toBe($expected)
        ->and($verifier->check('github', 'test-person'))->toBe($expected);
})->with([[404, null, 'inconclusive'], [410, null, 'invalid'], [403, null, 'inconclusive'], [429, null, 'inconclusive'], [302, null, 'inconclusive'], [503, null, 'inconclusive'], [200, null, 'inconclusive'], [200, 'TEST-PERSON', 'valid'], [200, 'other', 'inconclusive']]);

test('providers without authorized lookup are never contacted automatically', function () {
    $probe = Mockery::mock(ApplicationProfileProbe::class);
    $probe->shouldNotReceive('resolve');
    $probe->shouldNotReceive('lookup');
    $verifier = new ApplicationProfileVerifier(app(ApplicationProfileUrl::class), $probe);
    expect($verifier->check('linkedin', 'test-person'))->toBe('inconclusive')
        ->and($verifier->check('instagram', 'test.person'))->toBe('inconclusive');
});
