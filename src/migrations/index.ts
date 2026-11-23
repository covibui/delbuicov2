import * as migration_20261122_235020_initial from './20261122_235020_initial';
import * as migration_20261123_002931_remove_invite_email from './20261123_002931_remove_invite_email';

export const migrations = [
  {
    up: migration_20261122_235020_initial.up,
    down: migration_20261122_235020_initial.down,
    name: '20261122_235020_initial',
  },
  {
    up: migration_20261123_002931_remove_invite_email.up,
    down: migration_20261123_002931_remove_invite_email.down,
    name: '20261123_002931_remove_invite_email'
  },
];
