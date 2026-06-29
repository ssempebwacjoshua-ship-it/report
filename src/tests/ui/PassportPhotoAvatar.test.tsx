import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PassportPhotoAvatar } from "../../components/students/PassportPhotoAvatar";

describe("PassportPhotoAvatar", () => {
  it("renders a remote image URL", () => {
    const { container } = render(
      <PassportPhotoAvatar
        name="Grace Hopper"
        src="https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/demo/photo.webp"
        className="h-24 w-24"
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("alt")).toMatch(/grace hopper passport photo/i);
    expect(img?.getAttribute("src")).toContain("cloudinary.com");
  });

  it("renders local upload URLs through the API base", () => {
    const { container } = render(<PassportPhotoAvatar name="Grace Hopper" src="/uploads/students/demo/photo.webp" className="h-24 w-24" />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("http://localhost:4300/uploads/students/demo/photo.webp");
  });

  it("shows No photo for empty URLs", () => {
    render(<PassportPhotoAvatar name="Grace Hopper" src="" className="h-24 w-24" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/no photo/i)).toBeInTheDocument();
  });

  it("switches to the fallback avatar when the image errors", () => {
    const { container } = render(
      <PassportPhotoAvatar
        name="Grace Hopper"
        src="https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/demo/photo.webp"
        className="h-24 w-24"
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    fireEvent.error(img!);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/photo unavailable/i)).toBeInTheDocument();
  });
});
