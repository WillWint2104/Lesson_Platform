import { Link } from "react-router-dom";

export function NotFound({ message }: { message?: string }) {
  return (
    <main className="app-page">
      <section className="notfound">
        <h1 className="notfound__title">Not found</h1>
        <p className="notfound__text">{message ?? "That page doesn’t exist."}</p>
        <Link className="btn btn--primary" to="/">
          Back to library
        </Link>
      </section>
    </main>
  );
}
