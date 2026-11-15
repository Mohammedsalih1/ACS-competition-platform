import prisma from './prisma.js';

export async function getLocations(req, res) {
    const areas = await prisma.area.findMany();
    const hierarchy = areas.reduce((acc, current) => {
        // find or create state
        let state = acc.find(s => s.name === current.state);
        if (!state) {
            state = { name: current.state, cities: [] };
            acc.push(state);
        }
        
        // find or create city
        let city = state.cities.find(c => c.name === current.city);
        if (!city) {
            city = { name: current.city, areas: [] }
            state.cities.push(city);
        }

        // push area with name and id

        city.areas.push({ name: current.area, id: current.id})

        return acc;
    }, [])
    res.json({ hierarchy });
}

export async function areaStatus(req, res) {
    const { id } = req.valid.params;
    const area = await prisma.area.findUnique({ 
        where: { id },
        include: { schedules: true, comunityUpdates: true },
        
    });

    if (!area) return res.status(404).json({ message: 'area not found'});
    res.json(area);
}