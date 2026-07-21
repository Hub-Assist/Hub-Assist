import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenBlacklistService } from './token-blacklist.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** JWT ID — UUID v4, used for blacklisting on logout / role change. */
  jti?: string;
  /** Expiry timestamp (Unix seconds). */
  exp?: number;
  /** Issued-at timestamp (Unix seconds). */
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly tokenBlacklistService: TokenBlacklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'hubassist-secret',
    });
  }

  async validate(payload: JwtPayload) {
    // Single Redis GET — O(1), adds < 2 ms to request latency.
    if (payload.jti && (await this.tokenBlacklistService.isBlacklisted(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
