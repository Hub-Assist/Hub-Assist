import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { StellarHealthIndicator } from './indicators/stellar.health-indicator';
import { SmtpHealthIndicator } from './indicators/smtp.health-indicator';
import { CloudinaryHealthIndicator } from './indicators/cloudinary.health-indicator';

/**
 * Health check endpoints for Kubernetes probes and monitoring.
 *
 * Probe configuration summary:
 *
 *   GET /api/v1/health/live   → k8s livenessProbe  (always 200 while process is alive)
 *   GET /api/v1/health/ready  → k8s readinessProbe (503 when DB or Redis are unreachable)
 *   GET /api/v1/health/deep   → admin-only full dependency graph
 *   GET /api/v1/health        → alias for /ready (backward-compat)
 */
@ApiTags('Health')
@Controller('health')
@SkipThrottle() // health probes must never be rate-limited
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly stellar: StellarHealthIndicator,
    private readonly smtp: SmtpHealthIndicator,
    private readonly cloudinaryIndicator: CloudinaryHealthIndicator,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /health/live — Kubernetes livenessProbe
  // ---------------------------------------------------------------------------
  /**
   * Liveness probe.
   *
   * Returns HTTP 200 as long as the Node.js process is running.
   * **Never** checks external dependencies — a slow DB must not restart the pod.
   *
   * Kubernetes liveness probe YAML:
   * ```yaml
   * livenessProbe:
   *   httpGet:
   *     path: /api/v1/health/live
   *     port: 3001
   *   initialDelaySeconds: 10
   *   periodSeconds: 15
   *   failureThreshold: 3
   *   timeoutSeconds: 2
   * ```
   */
  @Get('live')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns 200 while the process is alive. Never fails due to external dependencies. ' +
      'Use as Kubernetes livenessProbe.',
  })
  @ApiOkResponse({ description: 'Process is alive' })
  liveness() {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /health/ready — Kubernetes readinessProbe
  // ---------------------------------------------------------------------------
  /**
   * Readiness probe.
   *
   * Returns HTTP 200 when the app can serve traffic (DB + Redis reachable).
   * Returns HTTP 503 when either dependency is down — the load balancer will
   * stop routing requests to this pod until it recovers.
   *
   * Each check has a 3-second timeout to keep total response time under 500 ms
   * in the happy path.
   *
   * Kubernetes readiness probe YAML:
   * ```yaml
   * readinessProbe:
   *   httpGet:
   *     path: /api/v1/health/ready
   *     port: 3001
   *   initialDelaySeconds: 15
   *   periodSeconds: 10
   *   failureThreshold: 3
   *   successThreshold: 1
   *   timeoutSeconds: 5
   * ```
   */
  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns 200 when DB and Redis are reachable. Returns 503 otherwise. ' +
      'Use as Kubernetes readinessProbe.',
  })
  @ApiOkResponse({ description: 'Application is ready to serve traffic' })
  @ApiServiceUnavailableResponse({ description: 'One or more critical dependencies are down' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  // ---------------------------------------------------------------------------
  // GET /health — backward-compatible alias for /ready
  // ---------------------------------------------------------------------------
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check (alias for /ready)',
    description: 'Backward-compatible alias. Prefer /health/ready for new integrations.',
  })
  @ApiOkResponse({ description: 'Application is healthy' })
  @ApiServiceUnavailableResponse({ description: 'One or more critical dependencies are down' })
  async check(): Promise<HealthCheckResult> {
    return this.readiness();
  }

  // ---------------------------------------------------------------------------
  // GET /health/deep — admin-only full dependency graph
  // ---------------------------------------------------------------------------
  /**
   * Deep health check — admin only.
   *
   * Checks all external dependencies: PostgreSQL, Redis, Stellar RPC, SMTP,
   * and Cloudinary. Optional services (Redis, SMTP, Cloudinary) report
   * `skipped` when not configured rather than failing.
   *
   * This endpoint is protected by JWT + ADMIN role and is intended for
   * monitoring dashboards and on-call runbooks, not k8s probes.
   */
  @Get('deep')
  @Roles(UserRole.ADMIN)
  @HealthCheck()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Deep health check (admin only)',
    description:
      'Checks all external dependencies. Requires ADMIN role. ' +
      'Not suitable for k8s probes — use /live and /ready instead.',
  })
  @ApiOkResponse({ description: 'All dependencies healthy' })
  @ApiServiceUnavailableResponse({ description: 'One or more dependencies are degraded or down' })
  async deep(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
      () => this.stellar.isHealthy('stellar_rpc'),
      () => this.smtp.isHealthy('smtp'),
      () => this.cloudinaryIndicator.isHealthy('cloudinary'),
    ]);
  }
}
