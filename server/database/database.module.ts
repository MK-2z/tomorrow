import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: async () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is not set');
        }
        const queryClient = postgres(databaseUrl, { max: 1 });
        const db = drizzle(queryClient, { schema });
        return db;
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}
