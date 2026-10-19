<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visitors', function (Blueprint $table): void {
            // UUID v7 emitido pelo backend em cookie first-party HttpOnly.
            $table->uuid('id')->primary();
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->timestamps();
        });

        Schema::create('visits', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('visitor_id')->constrained('visitors')->restrictOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('last_seen_at');
            $table->timestamps();
            $table->index(['visitor_id', 'last_seen_at']);
        });

        Schema::create('ip_addresses', function (Blueprint $table): void {
            $table->id();
            $table->string('ip', 45);
            $table->timestamp('first_observed_at');
            $table->timestamp('last_observed_at');
            $table->timestamp('ip_anonymized_at')->nullable();
            $table->timestamps();
            // Não é unique: IPs diferentes podem convergir para o mesmo /24 ou /48.
            $table->index('ip');
            $table->index('last_observed_at');
        });

        Schema::create('ip_geolocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ip_address_id')->constrained('ip_addresses')->restrictOnDelete();
            $table->char('country', 2)->nullable();
            $table->string('city')->nullable();
            $table->string('asn', 32)->nullable();
            $table->string('city_database_type')->nullable();
            $table->timestamp('city_database_built_at')->nullable();
            $table->string('asn_database_type')->nullable();
            $table->timestamp('asn_database_built_at')->nullable();
            $table->string('geo_status', 20)->default('unavailable');
            $table->timestamp('resolved_at');
            $table->timestamp('last_verified_at');
            $table->timestamp('valid_from');
            $table->timestamp('valid_until')->nullable();
            $table->timestamps();
            $table->index(['ip_address_id', 'valid_until']);
            $table->index(['geo_status', 'last_verified_at']);
        });

        Schema::create('visitor_observations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->foreignId('ip_geolocation_id')->nullable()->constrained('ip_geolocations')->restrictOnDelete();
            $table->text('user_agent')->nullable();
            $table->string('browser')->nullable();
            $table->string('os')->nullable();
            $table->string('device_type', 32)->nullable();
            $table->string('language', 64)->nullable();
            $table->text('referer')->nullable();
            $table->string('method', 10);
            $table->string('path', 512);
            $table->timestamp('observed_at');
            $table->timestamps();
            $table->index(['visit_id', 'observed_at']);
            $table->index(['ip_geolocation_id', 'observed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitor_observations');
        Schema::dropIfExists('ip_geolocations');
        Schema::dropIfExists('ip_addresses');
        Schema::dropIfExists('visits');
        Schema::dropIfExists('visitors');
    }
};
