export type FieldRecord = {
  id: string;
  title: string;
  image: any;
  full?: any;
  azimuth: string;
  readout: string;
  telemetry: string[];
  caption: string[];
};

export const RECORDS: FieldRecord[] = [
  {
    id: 'ANCHOR-01',
    title: 'ANCHOR POINT',
    image: require('../assets/cards/01-anchor.jpg'),
    full: require('../assets/cards/01-anchor-full.jpg'),
    azimuth: 'CALCULATED_AZIMUTH: 112°',
    readout: '+24',
    telemetry: ['TARGET_ID: 0x2A', 'ICE_SHELF: 1', 'DELTA: 04.8'],
    caption: ['ANALYZING_ANCHOR_', 'LOAD ...'],
  },
  {
    id: 'ASCENT-02',
    title: 'ASCENT VECTOR',
    image: require('../assets/cards/02-ascent.jpg'),
    full: require('../assets/cards/02-ascent-full.jpg'),
    azimuth: 'CALCULATED_AZIMUTH: 268°',
    readout: '+41',
    telemetry: ['TARGET_ID: 0x3C', 'THRUST_ARC: 2', 'DELTA: 07.6'],
    caption: ['ANALYZING_ASCENT_', 'VECTOR ...'],
  },
  {
    id: 'BIOME-03',
    title: 'SURFACE BIOME',
    image: require('../assets/cards/03-biome.jpg'),
    full: require('../assets/cards/03-biome-full.jpg'),
    azimuth: 'CALCULATED_AZIMUTH: 345°',
    readout: '+80',
    telemetry: ['TARGET_ID: 0x4F', 'MOSS_LAYER: 3', 'DELTA: 11.2'],
    caption: ['ANALYZING_SURFACE_', 'BIOME ...'],
  },
  {
    id: 'OPERATOR-04',
    title: 'OPERATOR',
    image: require('../assets/cards/04-operator.jpg'),
    full: require('../assets/cards/04-operator-full.jpg'),
    azimuth: 'CALCULATED_AZIMUTH: 019°',
    readout: '+13',
    telemetry: ['TARGET_ID: 0x5B', 'VISOR_LINK: 1', 'DELTA: 02.4'],
    caption: ['ANALYZING_OPERATOR_', 'UPLINK ...'],
  },
  {
    id: 'BASIN-05',
    title: 'BASIN DUSK',
    image: require('../assets/cards/05-basin.jpg'),
    full: require('../assets/cards/05-basin-full.jpg'),
    azimuth: 'CALCULATED_AZIMUTH: 201°',
    readout: '+57',
    telemetry: ['TARGET_ID: 0x6D', 'DUST_INDEX: 4', 'DELTA: 09.1'],
    caption: ['ANALYZING_BASIN_', 'HORIZON ...'],
  },
];
