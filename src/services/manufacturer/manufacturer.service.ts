import fp from "fastify-plugin"
import {FastifyInstance} from "fastify";
import {getAll} from "@/services/manufacturer/get-all.js";
import {get} from "@/services/manufacturer/get.js";
import {create} from "@/services/manufacturer/create.js";
import {update} from "@/services/manufacturer/update.js";
import {remove} from "@/services/manufacturer/remove.js";


declare module "fastify" {
	export interface FastifyInstance {
		manufacturerService: ManufacturerService
	}
}

export class ManufacturerService {
	getAll = getAll
	get = get
	create = create
	update = update
	remove = remove

	constructor(readonly fastify: FastifyInstance) {
	}

}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("manufacturerService", new ManufacturerService(fastify))
}, {
	name: "manufacturerService"
})