import * as migration_20261122_235020_initial from './20261122_235020_initial';

export const migrations = [
  {
    up: migration_20261122_235020_initial.up,
    down: migration_20261122_235020_initial.down,
    name: '20261122_235020_initial'
  },
];
