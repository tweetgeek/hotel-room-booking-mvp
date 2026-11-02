import type { Knex } from 'knex';

// Room names and descriptions are guest-facing data in Polish, not code (research R-17, Q27).
// Feature keys are translated by the web app.
const rooms = [
  {
    id: 1,
    name: 'Pokój dwuosobowy z balkonem',
    description:
      'Jasny pokój z dużym łóżkiem i balkonem z widokiem na ogród. Łazienka z prysznicem, ręczniki i kosmetyki w cenie.',
    features: JSON.stringify(['balcony', 'wifi', 'tv']),
    price_per_night: 32000,
  },
  {
    id: 2,
    name: 'Pokój rodzinny',
    description:
      'Przestronny pokój z łóżkiem małżeńskim i dwoma pojedynczymi. Na życzenie łóżeczko dla niemowlęcia; czajnik i zestaw do herbaty.',
    features: JSON.stringify(['wifi', 'tv', 'crib', 'kettle']),
    price_per_night: 45000,
  },
  {
    id: 3,
    name: 'Apartament z tarasem',
    description:
      'Sypialnia, salon z aneksem kuchennym i prywatny taras. Klimatyzacja, ekspres do kawy i miejsce do pracy.',
    features: JSON.stringify(['terrace', 'wifi', 'tv', 'kitchenette', 'air_conditioning']),
    price_per_night: 62000,
  },
];

export async function seed(db: Knex): Promise<void> {
  await db('rooms').insert(rooms).onConflict('id').merge();
}
