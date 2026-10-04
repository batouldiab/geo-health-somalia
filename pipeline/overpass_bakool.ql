[out:json][timeout:180];
// Bakool box: south, west, north, east. Clips Bay/Gedo/Hiraan edges; filter by ADM1 afterwards.
(
  nwr["amenity"~"^(hospital|clinic|doctors|health_post|pharmacy)$"](3.1,42.9,4.9,44.8);
  nwr["healthcare"](3.1,42.9,4.9,44.8);
  nwr["amenity"~"^(school|kindergarten|college|university)$"](3.1,42.9,4.9,44.8);
  nwr["place"~"^(city|town|village|hamlet)$"](3.1,42.9,4.9,44.8);
);
out center tags;
