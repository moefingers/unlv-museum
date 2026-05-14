import Link from "next/link";
import { Default } from "./_components/Default";

export default function Home() {
  return (
    <Default>
      <main>
        <h1>HOME</h1>
        <h2>Welcome to REST-Rant!</h2>
        <div className="card">
          <img
            className="cardChild"
            src="https://placebear.com/g/200/300"
            alt="200x300 placeholder bear"
          />
          <br />
          <p className="cardChild">
            Placebear delivered by <a href="http://ottodestruct.com">Otto</a> —{" "}
            <a href="http://placekitten.com/">Inspired by placekitten</a>
          </p>
        </div>
        <Link href="/originals/rest-rant-ssr/places">
          <button className="btn btn-primary">Places Page</button>
        </Link>
      </main>
    </Default>
  );
}
