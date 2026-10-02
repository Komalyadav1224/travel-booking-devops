// In-memory data store (seeded). Replace with a real DB (Postgres/Mongo) for production.
let destinations, packages, bookings, nextBookingId;

function reset() {
  destinations = [
    { id: 1, name: 'Goa', country: 'India', description: 'Beaches, nightlife and Portuguese heritage.' },
    { id: 2, name: 'Manali', country: 'India', description: 'Himalayan hill station for snow and adventure.' },
    { id: 3, name: 'Bali', country: 'Indonesia', description: 'Temples, rice terraces and surf.' },
    { id: 4, name: 'Dubai', country: 'UAE', description: 'Skyscrapers, desert safari and shopping.' }
  ];
  packages = [
    { id: 1, destinationId: 1, title: 'Goa Beach Escape', days: 4, price: 15000 },
    { id: 2, destinationId: 1, title: 'Goa Premium Resort', days: 5, price: 28000 },
    { id: 3, destinationId: 2, title: 'Manali Snow Trip', days: 5, price: 18000 },
    { id: 4, destinationId: 3, title: 'Bali Honeymoon', days: 6, price: 65000 },
    { id: 5, destinationId: 4, title: 'Dubai Desert Special', days: 4, price: 55000 }
  ];
  bookings = [];
  nextBookingId = 1;
}
reset();

module.exports = {
  reset,
  listDestinations: () => destinations,
  addDestination: (d) => { const x = { id: destinations.length + 1, ...d }; destinations.push(x); return x; },
  listPackages: (destinationId) =>
    destinationId ? packages.filter((p) => p.destinationId === Number(destinationId)) : packages,
  getPackage: (id) => packages.find((p) => p.id === Number(id)),
  listBookings: () => bookings,
  createBooking: ({ pkg, name, email, travelers }) => {
    const b = {
      id: nextBookingId++, packageId: pkg.id, packageTitle: pkg.title, name, email, travelers,
      totalPrice: pkg.price * travelers, status: 'CONFIRMED', createdAt: new Date().toISOString()
    };
    bookings.push(b);
    return b;
  },
  cancelBooking: (id) => {
    const b = bookings.find((x) => x.id === Number(id));
    if (b) b.status = 'CANCELLED';
    return b;
  }
};
