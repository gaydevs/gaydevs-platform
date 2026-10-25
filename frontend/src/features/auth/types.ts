import type { MaskedUser, OtpRequest } from './api'

export interface OtpLoginContext extends OtpRequest { user: MaskedUser }
