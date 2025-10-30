import fp from "fastify-plugin";
import {
	hasZodFastifySchemaValidationErrors,
	isResponseSerializationError
} from "fastify-type-provider-zod";


export default fp(
	async (fastify) => {
		fastify.setErrorHandler((err, req, reply) => {
			if (err.statusCode === 429) {
				return reply.status(429).send({
					status: "error",
					error: "You hit the rate limit! Slow down please!",
				});
			}

			if (hasZodFastifySchemaValidationErrors(err)) {
				return reply.code(400).send({
					status: "error",
					errors: (
						err.validation as { instancePath: string; message: string }[]
					).reduce((acc: Record<string, string>, err) => {
						if (!acc[err.instancePath]) {
							acc[err.instancePath.slice(1)] = err.message;
						}

						return acc;
					}, {}),
				});
			}

			if (isResponseSerializationError(err)) {
				console.log(err);
				fastify.log.error(
					{
						name: err.name,
						message: err.message,
						stack: err.stack,
						request: {
							method: req.method,
							url: req.url,
							query: req.query,
							params: req.params,
						},
					},
					"Response serialization error",
				);
				return reply.code(500).send({
					status: "error",
					error: "Response doesn't match the schema",
				});
			}

			if (err instanceof fastify.httpErrors.HttpError) {
				return reply
					.status(err.statusCode)
					.send({status: "error", error: err.message});
			}

			fastify.log.error(
				{
					err,
					request: {
						method: req.method,
						url: req.url,
						query: req.query,
						params: req.params,
					},
				},
				"Unhandled error occurred",
			);

			reply.status(500).send({status: "error", error: "Internal Server Error"});
		});
	},
	{
		dependencies: ["cloudinary"],
	},
);