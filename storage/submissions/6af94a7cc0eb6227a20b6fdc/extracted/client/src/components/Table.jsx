export default function Table()  {
    return (
        <div className="table-container">
            {/* <table className="table-content">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>time of cut</th>
                        <th>time of return</th>
                        <th>total hours of cut</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>friday 6, Nov</td>
                        <td>7 am</td>
                        <td>11 am</td>
                        <td>4 hours</td>
                    </tr>
                    <tr>
                        <td>friday 6, Nov</td>
                        <td>7 am</td>
                        <td>11 am</td>
                        <td>4 hours</td>
                    </tr>
                </tbody>
            </table> */}
            <div className="table-head">
                <p>date</p>
                <p>time of cut</p>
                <p>time of return</p>
                <p>total cut hours</p>
            </div>
            <div className="table-head">
                <p>Friday 6 Nov</p>
                <p>7am</p>
                <p>11am</p>
                <p>4 hours</p>
            </div>
        </div>

    )
}